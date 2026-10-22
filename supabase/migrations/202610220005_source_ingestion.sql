-- Academy-only ingestion state. Public clients never fetch/write feeds.
create table academy.feed_state (
  id text primary key check(id in ('arxiv-ai','arxiv-physics','nasa-news')),
  etag text, last_modified text, checked_at timestamptz, fetched_at timestamptz,
  latest_entry_at timestamptz, last_error text
);
insert into academy.feed_state(id) values('arxiv-ai'),('arxiv-physics'),('nasa-news');
create table academy.feed_locks (
  provider text primary key check(provider in ('arxiv','nasa')), token uuid, active_feed text references academy.feed_state, expires_at timestamptz,
  next_allowed_at timestamptz not null default now()
);
insert into academy.feed_locks(provider) values('arxiv'),('nasa');
create table academy.source_aliases (
  alias text primary key, source_id uuid not null references academy.sources on delete cascade
);
insert into academy.source_aliases select canonical_id,id from academy.sources;
alter table academy.feed_state enable row level security;
alter table academy.feed_locks enable row level security;
alter table academy.source_aliases enable row level security;
revoke all on academy.feed_state,academy.feed_locks,academy.source_aliases from public,anon,authenticated;
grant all on academy.feed_state,academy.feed_locks,academy.source_aliases to service_role;
grant select on academy.feed_state,academy.source_aliases to authenticated;
create policy editor_read on academy.feed_state for select to authenticated using((select academy.is_editor()));
create policy editor_read on academy.source_aliases for select to authenticated using((select academy.is_editor()));

create function academy.claim_feed(p_feed text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare provider_id text; lease uuid; state jsonb; begin
  provider_id := case when p_feed in ('arxiv-ai','arxiv-physics') then 'arxiv' when p_feed='nasa-news' then 'nasa' end;
  if provider_id is null then raise exception 'Unknown feed' using errcode='22023'; end if;
  update academy.feed_locks set token=gen_random_uuid(),active_feed=p_feed,expires_at=now()+interval '2 minutes',next_allowed_at=now()+interval '3 seconds'
    where provider=provider_id and next_allowed_at<=now() and (token is null or expires_at<=now()) returning token into lease;
  if lease is null then return null; end if;
  select to_jsonb(f) into state from academy.feed_state f where id=p_feed;
  return state || jsonb_build_object('token',lease,'provider',provider_id);
end $$;

create function academy.ingest_candidate(p_token uuid,p_entry jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare feed text:=p_entry->>'feedId'; provider_id text; v_source uuid; v_story uuid;
  aliases text[]; alias_id text; known uuid[]; canonical text:=p_entry->>'canonicalId'; normalized text;
  link text:=p_entry->>'url'; title text:=trim(p_entry->>'titleEn'); domain text:=p_entry->>'domain'; begin
  provider_id := case when feed in ('arxiv-ai','arxiv-physics') then 'arxiv' when feed='nasa-news' then 'nasa' end;
  if provider_id is null or not exists(select 1 from academy.feed_locks where provider=provider_id and active_feed=feed and token=p_token and expires_at>now()) then
    raise exception 'Feed lease required' using errcode='42501';
  end if;
  if canonical is null or length(canonical)>500 or title is null or length(title) not between 3 and 500 or domain is null
    or (feed='arxiv-ai' and domain<>'ai') or (feed<>'arxiv-ai' and domain<>'physics')
    or (provider_id='arxiv' and (canonical !~ '^arxiv:([0-9]{4}\.[0-9]{4,5}|[a-z-]+(\.[a-z]{2})?/[0-9]{7})$' or link is distinct from 'https://arxiv.org/abs/'||substr(canonical,7)))
    or (provider_id='nasa' and (canonical !~ '^nasa:/news-release/[^[:space:]?#]+$' or link is distinct from 'https://www.nasa.gov'||substr(canonical,6))) then
    raise exception 'Invalid source entry' using errcode='22023';
  end if;
  select array_agg(distinct value order by value) into aliases from jsonb_array_elements_text(p_entry->'aliases');
  if aliases is null or array_length(aliases,1)>5 or not(canonical=any(aliases)) then raise exception 'Invalid aliases' using errcode='22023'; end if;
  foreach alias_id in array aliases loop
    if length(alias_id)>500 or (alias_id<>canonical and (provider_id='nasa' or alias_id !~ '^doi:10\.[0-9]{4,9}/[^[:space:]]+$')) then raise exception 'Invalid alias' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('source:'||alias_id,0));
  end loop;
  select array_agg(distinct id) into known from (
    select id from academy.sources where canonical_id=any(aliases)
    union select source_id from academy.source_aliases where alias=any(aliases)
  ) existing;
  if array_length(known,1)>1 then raise exception 'Source identity conflict; review required' using errcode='22023'; end if;
  v_source:=known[1];
  if v_source is null then
    insert into academy.sources(canonical_id,url,title_en,kind) values(canonical,link,title,case provider_id when 'arxiv' then 'preprint' else 'institution' end) returning id into v_source;
  end if;
  -- Metadata only; never assert full-text availability, reuse rights or scientific verification.
  update academy.sources set metadata=metadata || jsonb_build_object('intake','feed','feedId',feed,'metadataUrl',link,'originalDateBasis',case when provider_id='arxiv' then 'arxiv_first_submission' else 'unknown' end,
    'originalPublishedAt',(p_entry->>'originalPublishedAt')::timestamptz,'revisionAt',(p_entry->>'revisionAt')::timestamptz,
    'pressReleaseAt',(p_entry->>'pressReleaseAt')::timestamptz,'fetchedAt',(p_entry->>'fetchedAt')::timestamptz,
    'categories',p_entry->'categories','flags',p_entry->'flags','primarySourceRequired',provider_id='nasa') where id=v_source;
  insert into academy.source_aliases select unnest(aliases),v_source on conflict do nothing;
  -- Reuse an existing manual story linked to any identity of the same paper.
  select s.id into v_story from academy.stories s join academy.story_sources ss on ss.story_id=s.id where ss.source_id=v_source order by s.created_at limit 1;
  if v_story is null then
    insert into academy.stories(slug,title_en) values('source-'||md5(canonical),title) returning id into v_story;
    insert into academy.story_sources values(v_story,v_source);
  end if;
  insert into academy.story_domains values(v_story,domain) on conflict do nothing;
  select canonical_id into normalized from academy.sources where id=v_source;
  if provider_id='arxiv' then perform academy.enqueue_job('normalize_source','normalize:'||normalized,jsonb_build_object('identifier',normalized),v_story); end if;
  return v_story;
end $$;

create function academy.finish_feed(p_feed text,p_token uuid,p_status integer,p_etag text,p_last_modified text,p_latest_entry timestamptz,p_error text default null,p_delay integer default 3)
returns boolean language plpgsql security definer set search_path='' as $$
declare provider_id text; begin
  provider_id := case when p_feed in ('arxiv-ai','arxiv-physics') then 'arxiv' when p_feed='nasa-news' then 'nasa' end;
  update academy.feed_locks set token=null,active_feed=null,expires_at=null,next_allowed_at=greatest(next_allowed_at,now()+make_interval(secs=>greatest(3,least(86400,p_delay))))
    where provider=provider_id and active_feed=p_feed and token=p_token and expires_at>now();
  if not found then return false; end if;
  update academy.feed_state set checked_at=now(),last_error=left(p_error,200),
    fetched_at=case when p_status=200 and p_error is null then now() else fetched_at end,
    etag=case when p_status=200 and p_error is null then left(p_etag,1000) else etag end,
    last_modified=case when p_status=200 and p_error is null then left(p_last_modified,200) else last_modified end,
    latest_entry_at=case when p_status=200 and p_error is null then p_latest_entry else latest_entry_at end where id=p_feed;
  return true;
end $$;
revoke all on function academy.claim_feed(text),academy.ingest_candidate(uuid,jsonb),academy.finish_feed(text,uuid,integer,text,text,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function academy.claim_feed(text),academy.ingest_candidate(uuid,jsonb),academy.finish_feed(text,uuid,integer,text,text,timestamptz,text,integer) to service_role;

-- Manual intake participates in the same identity locks and aliases as feed intake.
create or replace function academy.create_candidate(p_canonical_id text,p_title text,p_domain text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_source uuid; v_story uuid; normalized text; begin
  if not exists(select 1 from academy.editor_members where user_id=auth.uid() and role='editor') then raise exception 'Editor role required' using errcode='42501'; end if;
  if p_canonical_id is null or length(p_canonical_id)>500 or p_canonical_id<>lower(p_canonical_id)
    or not(p_canonical_id ~ '^doi:10\.[0-9]{4,9}/[^[:space:]]+$' or p_canonical_id ~ '^arxiv:([0-9]{4}\.[0-9]{4,5}|[a-z-]+(\.[a-z]{2})?/[0-9]{7})$')
    or p_title is null or length(trim(p_title)) not between 3 and 500 or p_domain is null or p_domain not in ('ai','physics') then raise exception 'Invalid candidate input' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('source:'||p_canonical_id,0));
  select source_id into v_source from academy.source_aliases where alias=p_canonical_id;
  if v_source is null then select id into v_source from academy.sources where canonical_id=p_canonical_id; end if;
  if v_source is null then
    insert into academy.sources(canonical_id,url,title_en,kind,metadata) values(p_canonical_id,
      case when p_canonical_id like 'doi:%' then 'https://doi.org/'||substr(p_canonical_id,5) else 'https://arxiv.org/abs/'||substr(p_canonical_id,7) end,
      trim(p_title),case when p_canonical_id like 'arxiv:%' then 'preprint' else 'paper' end,
      jsonb_build_object('intake','manual','createdBy',auth.uid(),'dateStatus','unknown')) returning id into v_source;
  end if;
  insert into academy.source_aliases values(p_canonical_id,v_source) on conflict do nothing;
  select s.id into v_story from academy.stories s join academy.story_sources ss on ss.story_id=s.id where ss.source_id=v_source order by s.created_at limit 1;
  if v_story is null then
    insert into academy.stories(slug,title_en) values('source-'||md5(p_canonical_id),trim(p_title)) returning id into v_story;
    insert into academy.story_sources values(v_story,v_source);
  end if;
  insert into academy.story_domains values(v_story,p_domain) on conflict do nothing;
  select canonical_id into normalized from academy.sources where id=v_source;
  perform academy.enqueue_job('normalize_source','normalize:'||normalized,jsonb_build_object('identifier',normalized),v_story);
  return v_story;
end $$;
