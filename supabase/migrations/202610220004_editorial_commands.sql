-- Academy only. No Auth settings, legacy tables or browser write grants change.
alter table academy.stories add column editorial_version integer not null default 0 check(editorial_version >= 0);
alter table academy.editorial_decisions add column request_id uuid unique;

create function academy.create_candidate(p_canonical_id text,p_title text,p_domain text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare source_id uuid; story_id uuid; source_url text; begin
  if not exists(select 1 from academy.editor_members where user_id=auth.uid() and role='editor') then
    raise exception 'Editor role required' using errcode='42501';
  end if;
  if p_canonical_id is null or length(p_canonical_id)>500 or p_canonical_id<>lower(p_canonical_id)
    or not (p_canonical_id ~ '^doi:10\.[0-9]{4,9}/[^[:space:]]+$'
      or p_canonical_id ~ '^arxiv:([0-9]{4}\.[0-9]{4,5}|[a-z-]+(\.[a-z]{2})?/[0-9]{7})$')
    or p_title is null or length(trim(p_title)) not between 3 and 500
    or p_domain is null or p_domain not in ('ai','physics') then
    raise exception 'Invalid candidate input' using errcode='22023';
  end if;
  source_url := case when p_canonical_id like 'doi:%' then 'https://doi.org/'||substr(p_canonical_id,5)
    else 'https://arxiv.org/abs/'||substr(p_canonical_id,7) end;
  insert into academy.sources(canonical_id,url,title_en,kind,metadata)
    values(p_canonical_id,source_url,trim(p_title),case when p_canonical_id like 'arxiv:%' then 'preprint' else 'paper' end,
      jsonb_build_object('intake','manual','createdBy',auth.uid(),'dateStatus','unknown'))
    on conflict(canonical_id) do nothing;
  select id into source_id from academy.sources where canonical_id=p_canonical_id for update;
  insert into academy.stories(slug,title_en) values('source-'||md5(p_canonical_id),trim(p_title))
    on conflict(slug) do nothing;
  select id into story_id from academy.stories where slug='source-'||md5(p_canonical_id);
  insert into academy.story_sources values(story_id,source_id) on conflict do nothing;
  insert into academy.story_domains values(story_id,p_domain) on conflict do nothing;
  perform academy.enqueue_job('normalize_source','normalize:'||p_canonical_id,jsonb_build_object('identifier',p_canonical_id),story_id);
  return story_id;
end $$;

create function academy.record_selection(p_story_id uuid,p_decision text,p_reason text,p_expected_version integer,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare story academy.stories; previous academy.editorial_decisions; result_id uuid; begin
  if not exists(select 1 from academy.editor_members where user_id=auth.uid() and role='editor') then
    raise exception 'Editor role required' using errcode='42501';
  end if;
  if p_decision is null or p_decision not in ('select','reject','hold','revise') or p_reason is null
    or length(trim(p_reason)) not between 3 and 2000 or p_request_id is null or p_expected_version is null then
    raise exception 'Invalid selection input' using errcode='22023';
  end if;
  select * into story from academy.stories where id=p_story_id for update;
  if not found then raise exception 'Story not found' using errcode='22023'; end if;
  select * into previous from academy.editorial_decisions where request_id=p_request_id;
  if found then
    if previous.story_id<>p_story_id or previous.actor_id<>auth.uid()::text or previous.decision<>p_decision or previous.reason<>trim(p_reason) then
      raise exception 'Request identity reused' using errcode='22023';
    end if;
    return previous.id;
  end if;
  if story.status='published' or story.editorial_version<>p_expected_version then
    raise exception 'Story changed; reload before deciding' using errcode='40001';
  end if;
  insert into academy.editorial_decisions(story_id,actor_type,actor_id,decision,reason,policy_version,request_id)
    values(p_story_id,'human',auth.uid()::text,p_decision,trim(p_reason),'selection/1',p_request_id) returning id into result_id;
  update academy.stories set editorial_version=editorial_version+1,
    status=case p_decision when 'select' then 'researching' when 'revise' then 'review' else 'held' end where id=p_story_id;
  return result_id;
end $$;
revoke all on function academy.create_candidate(text,text,text), academy.record_selection(uuid,text,text,integer,uuid) from public,anon,service_role;
grant execute on function academy.create_candidate(text,text,text), academy.record_selection(uuid,text,text,integer,uuid) to authenticated;
