-- SCI-002. Academy only; no Auth, storage or production configuration changes.
create table academy.metadata_snapshots (
 id uuid primary key default gen_random_uuid(), identity text not null, provider text not null check(provider in ('arxiv','crossref')),
 adapter_version text not null check(adapter_version='primary-metadata/1'), retrieved_at timestamptz not null default now(),
 raw_payload text not null check(octet_length(raw_payload) between 1 and 2000000), payload_hash text not null,
 normalized jsonb not null, unique(identity,adapter_version,payload_hash),
 check(normalized->>'identity'=identity), check(normalized->>'scientificStatus'='unverified'),
 check(normalized->>'bibliographicStatus'='metadata_confirmed')
);
create index on academy.metadata_snapshots(identity,retrieved_at desc);
create table academy.metadata_fetches (
 id uuid primary key default gen_random_uuid(), identity text not null, fetched_at timestamptz not null default now(),
 status integer not null, error_code text, snapshot_id uuid references academy.metadata_snapshots
);
create table academy.identity_proposals (
 id uuid primary key default gen_random_uuid(), arxiv_snapshot uuid not null references academy.metadata_snapshots,
 doi_snapshot uuid not null references academy.metadata_snapshots, created_at timestamptz not null default now(),
 unique(arxiv_snapshot,doi_snapshot)
);
create table academy.identity_confirmations (
 id uuid primary key default gen_random_uuid(), proposal_id uuid not null references academy.identity_proposals,
 actor uuid not null references auth.users, reason text not null check(length(trim(reason)) between 10 and 2000),
 created_at timestamptz not null default now(), source_id uuid references academy.sources,
 outcome text not null check(outcome in ('confirmed','conflict')), command_id uuid not null unique
);
create table academy.pending_resolutions (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references academy.external_review_items,
 version integer not null, previous_id uuid references academy.pending_resolutions, snapshot_id uuid not null references academy.metadata_snapshots,
 source_id uuid not null references academy.sources, story_id uuid not null references academy.stories,
 actor uuid not null references auth.users, reason text not null check(length(trim(reason)) between 10 and 2000),
 created_at timestamptz not null default now(), command_id uuid not null unique, unique(item_id,version)
);
-- Every extracted event is an immutable observation, including pending imports and repeated reported events.
create table academy.review_event_observations (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references academy.external_review_items,
 ordinal integer not null check(ordinal>=1), reported jsonb not null,
 legacy_event_id uuid references academy.scientific_events, unique(item_id,ordinal)
);
create table academy.canonical_scientific_events (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references academy.sources,
 kind text not null, basis text not null, value text not null, unique(source_id,kind,basis,value)
);
create table academy.event_reconciliations (
 id uuid primary key default gen_random_uuid(), observation_id uuid not null references academy.review_event_observations,
 version integer not null, previous_id uuid references academy.event_reconciliations,
 event_id uuid not null references academy.canonical_scientific_events,
 snapshot_id uuid not null references academy.metadata_snapshots, actor uuid not null references auth.users,
 reason text not null check(length(trim(reason)) between 10 and 2000), created_at timestamptz not null default now(),
 command_id uuid not null, unique(observation_id,version), unique(command_id,observation_id)
);
do $$ declare t text; begin
 foreach t in array array['metadata_snapshots','metadata_fetches','identity_proposals','identity_confirmations','pending_resolutions','review_event_observations','canonical_scientific_events','event_reconciliations'] loop
 execute format('alter table academy.%I enable row level security',t);
 execute format('revoke all on academy.%I from public,anon,authenticated',t);
 execute format('grant select on academy.%I to authenticated',t);
 execute format('grant select,insert on academy.%I to service_role',t);
 execute format('create policy member_read on academy.%I for select to authenticated using((select academy.is_editor()))',t);
 execute format('create trigger immutable before update or delete on academy.%I for each row execute function academy.external_review_immutable()',t);
 end loop;
end $$;

create function academy.require_writing_editor() returns void language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from academy.editor_members where user_id=auth.uid() and role='editor') then raise exception 'Editor role required' using errcode='42501'; end if;
end $$;
create function academy.valid_publication_identity(p text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(length(p)<=500 and p=lower(p) and (p ~ '^arxiv:([0-9]{4}\.[0-9]{4,5}|[a-z-]+(\.[a-z]{2})?/[0-9]{7})$' or p ~ '^doi:10\.[0-9]{4,9}/[^[:space:]]+$'),false);
$$;
create function academy.request_metadata(p_identity text) returns uuid language plpgsql security definer set search_path='' as $$ begin
 perform academy.require_writing_editor();
 if not academy.valid_publication_identity(p_identity) then raise exception 'Invalid publication identity' using errcode='22023'; end if;
 return academy.enqueue_job('metadata_enrichment','metadata:'||p_identity||':'||(now() at time zone 'UTC')::date::text,jsonb_build_object('identifier',p_identity));
end $$;

-- Same arXiv lock as feed intake. Never run a separate per-feature rate limiter.
alter table academy.feed_locks drop constraint feed_locks_provider_check;
alter table academy.feed_locks add constraint feed_locks_provider_check check(provider in ('arxiv','nasa','crossref'));
insert into academy.feed_locks(provider) values('crossref');
create function academy.claim_metadata(p_identity text) returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid; begin
 if not academy.valid_publication_identity(p_identity) then raise exception 'Invalid publication identity' using errcode='22023'; end if;
 update academy.feed_locks set token=gen_random_uuid(),active_feed=null,expires_at=now()+interval '2 minutes',next_allowed_at=now()+interval '3 seconds'
 where provider=case when p_identity like 'arxiv:%' then 'arxiv' else 'crossref' end and next_allowed_at<=now() and (token is null or expires_at<=now()) returning token into v;
 return v;
end $$;
create function academy.finish_metadata(p_identity text,p_token uuid,p_status integer,p_raw text,p_normalized jsonb,p_delay integer default 3) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid; provider_id text:=case when p_identity like 'arxiv:%' then 'arxiv' else 'crossref' end; h text; begin
 update academy.feed_locks set token=null,expires_at=null,next_allowed_at=greatest(next_allowed_at,now()+make_interval(secs=>greatest(3,least(86400,coalesce(p_delay,60)))))
 where provider=provider_id and active_feed is null and token=p_token and expires_at>now();
 if not found then raise exception 'Metadata lease lost' using errcode='42501'; end if;
 if p_status=200 then
 if p_raw is null or p_normalized->>'identity' is distinct from p_identity or p_normalized->>'provider' is distinct from provider_id
 or p_normalized->>'scientificStatus' is distinct from 'unverified' or p_normalized->>'bibliographicStatus' is distinct from 'metadata_confirmed'
 or length(coalesce(p_normalized->>'title',''))=0 then raise exception 'Invalid normalized metadata' using errcode='22023'; end if;
 h:=encode(extensions.digest(convert_to(p_raw,'UTF8'),'sha256'),'hex');
 insert into academy.metadata_snapshots(identity,provider,adapter_version,raw_payload,payload_hash,normalized)
 values(p_identity,provider_id,'primary-metadata/1',p_raw,h,p_normalized) on conflict do nothing;
 select id into v from academy.metadata_snapshots where identity=p_identity and payload_hash=h and adapter_version='primary-metadata/1';
 if exists(select 1 from academy.metadata_snapshots where id=v and normalized is distinct from p_normalized) then raise exception 'Adapter result conflicts with immutable snapshot' using errcode='22023'; end if;
 end if;
 insert into academy.metadata_fetches(identity,status,error_code,snapshot_id) values(p_identity,p_status,case when p_status=200 then null else 'METADATA_'||p_status::text end,v);
 return v;
end $$;

create function academy.propose_identity(p_arxiv uuid,p_doi uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a academy.metadata_snapshots; d academy.metadata_snapshots; v uuid; begin
 perform academy.require_writing_editor();
 select * into a from academy.metadata_snapshots where id=p_arxiv; select * into d from academy.metadata_snapshots where id=p_doi;
 if a.provider is distinct from 'arxiv' or d.provider is distinct from 'crossref' or a.normalized->>'doi' is distinct from d.identity then
 raise exception 'Explicit primary relationship required' using errcode='22023'; end if;
 -- Consistency warnings are presented by the application. Confirmation retains the exact two snapshots.
 insert into academy.identity_proposals(arxiv_snapshot,doi_snapshot) values(p_arxiv,p_doi) on conflict do nothing;
 select id into v from academy.identity_proposals where arxiv_snapshot=p_arxiv and doi_snapshot=p_doi; return v;
end $$;
create function academy.confirm_identity(p_proposal uuid,p_reason text,p_command uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a text; d text; k text; ids uuid[]; v uuid; outcome text; prior academy.identity_confirmations; begin
 perform academy.require_writing_editor();
 if p_command is null or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'Reason and command required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('identity-command:'||p_command::text,0));
 select * into prior from academy.identity_confirmations where command_id=p_command;
 if found then
 if prior.actor<>auth.uid() or prior.proposal_id<>p_proposal or prior.reason<>p_reason then raise exception 'Command conflict' using errcode='22023'; end if;
 return to_jsonb(prior); end if;
 select s.identity,t.identity into a,d from academy.identity_proposals p join academy.metadata_snapshots s on s.id=p.arxiv_snapshot join academy.metadata_snapshots t on t.id=p.doi_snapshot
 where p.id=p_proposal and s.provider='arxiv' and t.provider='crossref' and s.normalized->>'doi'=t.identity;
 if a is null then raise exception 'Primary proposal required' using errcode='22023'; end if;
 for k in select unnest(array[a,d]) order by 1 loop perform pg_advisory_xact_lock(hashtextextended('source:'||k,0)); end loop;
 select array_agg(distinct id) into ids from (select id from academy.sources where canonical_id in (a,d) union select source_id from academy.source_aliases where alias in (a,d)) x;
 if coalesce(array_length(ids,1),0)>1 then outcome:='conflict';
 elsif ids[1] is null then raise exception 'Create or resolve a candidate before linking' using errcode='22023';
 else
 v:=ids[1];outcome:='confirmed';
 insert into academy.source_aliases values(a,v),(d,v) on conflict do nothing;
 end if;
 insert into academy.identity_confirmations(proposal_id,actor,reason,source_id,outcome,command_id) values(p_proposal,auth.uid(),p_reason,v,outcome,p_command) returning * into prior;
 return to_jsonb(prior);
end $$;

create function academy.resolve_pending(p_item uuid,p_snapshot uuid,p_expected integer,p_reason text,p_command uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare i academy.external_review_items; s academy.metadata_snapshots; prev academy.pending_resolutions; v uuid; story uuid; source uuid; prior academy.pending_resolutions; begin
 perform academy.require_writing_editor();
 if p_command is null or length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'Reason and command required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pending:'||p_item::text,0));
 select * into prior from academy.pending_resolutions where command_id=p_command;
 if found then
 if prior.actor<>auth.uid() or prior.item_id<>p_item or prior.snapshot_id<>p_snapshot or prior.reason<>p_reason or p_expected is distinct from prior.version-1 then raise exception 'Command conflict' using errcode='22023'; end if;
 return prior.id; end if;
 select * into i from academy.external_review_items where id=p_item;
 select * into s from academy.metadata_snapshots where id=p_snapshot;
 if i.disposition is distinct from 'needs_identification' or i.extraction->>'domain' not in ('ai','physics') or s.id is null then raise exception 'Pending active item and metadata required' using errcode='22023'; end if;
 select * into prev from academy.pending_resolutions where item_id=p_item order by version desc limit 1;
 if p_expected is distinct from coalesce(prev.version,0) then raise exception 'Stale resolution' using errcode='40001'; end if;
 perform pg_advisory_xact_lock(hashtextextended('source:'||s.identity,0));
 if (select count(distinct id) from (select id from academy.sources where canonical_id=s.identity union select source_id from academy.source_aliases where alias=s.identity) x)>1 then raise exception 'Source identity conflict' using errcode='22023'; end if;
 story:=academy.create_candidate(s.identity,left(s.normalized->>'title',500),i.extraction->>'domain');
 select source_id into source from academy.source_aliases where alias=s.identity;
 insert into academy.pending_resolutions(item_id,version,previous_id,snapshot_id,source_id,story_id,actor,reason,command_id)
 values(p_item,coalesce(prev.version,0)+1,prev.id,p_snapshot,source,story,auth.uid(),p_reason,p_command) returning id into v;
 return v;
end $$;

alter table academy.scientific_events add column observation_index integer;
create function academy.capture_review_observations(p_item uuid) returns void language sql security definer set search_path='' as $$
 insert into academy.review_event_observations(item_id,ordinal,reported,legacy_event_id)
 select i.id,e.ordinality::integer,e.value,(select s.id from academy.scientific_events s where s.review_item_id=i.id and s.kind=e.value->>'kind'
 and (s.observation_index is null or s.observation_index=e.ordinality)
 and s.reported_iso_date is not distinct from (e.value->>'date')::date and s.revision is not distinct from (e.value->>'revision')::integer
 order by s.id limit 1)
 from academy.external_review_items i cross join lateral jsonb_array_elements(i.extraction->'events') with ordinality e
 where i.id=p_item on conflict(item_id,ordinal) do nothing;
$$;
select academy.capture_review_observations(id) from academy.external_review_items;

-- Reconciliation only supports provider-backed anchors; unknown dates are not equal by default.
create function academy.reconcile_events(p_observations uuid[],p_snapshot uuid,p_kind text,p_basis text,p_expected jsonb,p_reason text,p_command uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s academy.metadata_snapshots; src uuid; anchor text; ev uuid; obs uuid; prev academy.event_reconciliations; prior academy.event_reconciliations; o academy.review_event_observations; item academy.external_review_items; story uuid; mapped uuid; begin
 perform academy.require_writing_editor();
 if p_command is null or length(trim(coalesce(p_reason,''))) not between 10 and 2000 or coalesce(array_length(p_observations,1),0) not between 1 and 20
 or array_length(p_observations,1)<>(select count(distinct x) from unnest(p_observations) x) then raise exception 'Invalid reconciliation input' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('event-command:'||p_command::text,0));
 select * into s from academy.metadata_snapshots where id=p_snapshot;
 select source_id into src from academy.source_aliases where alias=s.identity;
 if src is null then raise exception 'Resolved primary identity required' using errcode='22023'; end if;
 if s.provider='arxiv' and p_kind='initial_preprint' and p_basis='initialPublished' then anchor:=s.normalized#>>'{dates,initialPublished}';
 elsif s.provider='arxiv' and p_kind='preprint_revision' and p_basis='version' then anchor:=s.normalized->>'version';
 elsif s.provider='crossref' and p_kind='journal_publication' and p_basis in ('published','published-online','published-print') then
 if jsonb_array_length(s.normalized#>array['dates',p_basis,'date-parts','0'])=3 then anchor:=(s.normalized#>array['dates',p_basis,'date-parts','0'])::text; end if;
 elsif s.provider='crossref' and p_kind in ('correction','retraction') and p_basis ~ '^update:[0-9]{1,2}$' then
 select x->>'DOI' into anchor from jsonb_array_elements(s.normalized->'updates') with ordinality u(x,n) where n=substr(p_basis,8)::integer+1 and x->>'type'=p_kind;
 end if;
 if anchor is null or anchor='' then raise exception 'Provider event anchor required' using errcode='22023'; end if;
 insert into academy.canonical_scientific_events(source_id,kind,basis,value) values(src,p_kind,p_basis,anchor) on conflict do nothing;
 select id into ev from academy.canonical_scientific_events where source_id=src and kind=p_kind and basis=p_basis and value=anchor;
 -- One command is exactly one atomic set, not an extendable client-controlled batch.
 if exists(select 1 from academy.event_reconciliations where command_id=p_command) and
 (select array_agg(observation_id order by observation_id) from academy.event_reconciliations where command_id=p_command) is distinct from
 (select array_agg(x order by x) from unnest(p_observations) x) then raise exception 'Command conflict' using errcode='22023'; end if;
 for obs in select unnest(p_observations) order by 1 loop
 perform pg_advisory_xact_lock(hashtextextended('observation:'||obs::text,0));
 select * into prior from academy.event_reconciliations where command_id=p_command and observation_id=obs;
 if found then
 if prior.event_id<>ev or prior.snapshot_id<>p_snapshot or prior.actor<>auth.uid() or prior.reason<>p_reason or (p_expected->>obs::text)::integer is distinct from prior.version-1 then raise exception 'Command conflict' using errcode='22023'; end if;
 continue; end if;
 select * into o from academy.review_event_observations where id=obs;
 select * into item from academy.external_review_items where id=o.item_id;
 select r.story_id into story from academy.pending_resolutions r where r.item_id=item.id order by r.version desc limit 1;
 story:=coalesce(story,item.story_id);
 select a.source_id into mapped from academy.source_aliases a where a.alias=o.reported->>'referenceIdentity';
 if o.id is null or o.reported->>'kind' is distinct from p_kind or not exists(select 1 from academy.story_sources where story_id=story and source_id=src)
 or (o.reported->>'referenceIdentity' is not null and mapped is distinct from src)
 then raise exception 'Observation identity or kind conflict' using errcode='22023'; end if;
 -- A contrary reported date/version is not silently overwritten by the provider anchor.
 if p_basis='version' and o.reported->>'revision' is not null and o.reported->>'revision'<>anchor then raise exception 'Observation revision conflict' using errcode='22023'; end if;
 if p_basis='version' and o.reported->>'date' is not null and o.reported->>'date' is distinct from left(s.normalized#>>'{dates,updated}',10) then raise exception 'Observation date conflict' using errcode='22023'; end if;
 if o.reported->>'date' is not null and p_basis<>'version' and p_basis not like 'update:%' then
 if (p_basis='initialPublished' and o.reported->>'date'<>left(anchor,10)) or
 (p_basis<>'initialPublished' and (o.reported->>'date')::date<>make_date((s.normalized#>>array['dates',p_basis,'date-parts','0','0'])::int,(s.normalized#>>array['dates',p_basis,'date-parts','0','1'])::int,(s.normalized#>>array['dates',p_basis,'date-parts','0','2'])::int)) then raise exception 'Observation date conflict' using errcode='22023'; end if;
 end if;
 select * into prev from academy.event_reconciliations where observation_id=obs order by version desc limit 1;
 if (p_expected->>obs::text)::integer is distinct from coalesce(prev.version,0) then raise exception 'Stale reconciliation' using errcode='40001'; end if;
 insert into academy.event_reconciliations(observation_id,version,previous_id,event_id,snapshot_id,actor,reason,command_id)
 values(obs,coalesce(prev.version,0)+1,prev.id,ev,p_snapshot,auth.uid(),p_reason,p_command);
 end loop;
 return ev;
end $$;

-- Lock down helpers and commands explicitly; reviewer can read but never confirm or enqueue.
revoke all on function academy.require_writing_editor(),academy.valid_publication_identity(text),academy.capture_review_observations(uuid),academy.request_metadata(text),academy.claim_metadata(text),academy.finish_metadata(text,uuid,integer,text,jsonb,integer),academy.propose_identity(uuid,uuid),academy.confirm_identity(uuid,text,uuid),academy.resolve_pending(uuid,uuid,integer,text,uuid),academy.reconcile_events(uuid[],uuid,text,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function academy.request_metadata(text),academy.propose_identity(uuid,uuid),academy.confirm_identity(uuid,text,uuid),academy.resolve_pending(uuid,uuid,integer,text,uuid),academy.reconcile_events(uuid[],uuid,text,text,jsonb,text,uuid) to authenticated;
grant execute on function academy.claim_metadata(text),academy.finish_metadata(text,uuid,integer,text,jsonb,integer) to service_role;
notify pgrst,'reload schema';

-- Preserve installed migrations and existing event UUIDs.
create or replace function academy.import_external_review(p_markdown text,p_source_type text,p_parser_version text,p_items text,p_attestation text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_hash text; v_document_hash text; v_review uuid; item jsonb; extraction jsonb; event jsonb;
  v_item uuid; v_story uuid; v_source uuid; identity text; domain text; matches integer;
  event_key text; v_kind text; v_date date; v_added integer; v_version integer; v_items jsonb; v_signature text; v_ordinal bigint;
begin
  if not exists(select 1 from academy.editor_members where user_id=auth.uid() and role='editor') then raise exception 'Editor role required' using errcode='42501'; end if;
  if p_markdown is null or octet_length(p_markdown) not between 1 and 262144 or length(trim(p_markdown))=0
    or p_source_type is null or p_source_type not in ('chatgpt','external_review') or p_parser_version is distinct from 'external-review/1'
    or p_items is null or octet_length(p_items)>1048576 then raise exception 'Invalid review input' using errcode='22023'; end if;
  v_hash:=encode(extensions.digest(convert_to(p_markdown,'UTF8'),'sha256'),'hex');
  select encode(extensions.hmac(convert_to('review-import/1'||E'\n'||auth.uid()::text||E'\n'||p_parser_version||E'\n'||p_source_type||E'\n'||v_hash||E'\n'||encode(extensions.digest(convert_to(p_items,'UTF8'),'sha256'),'hex'),'UTF8'),secret,'sha256'),'hex')
    into v_signature from academy.review_import_signing_key where id;
  if p_attestation is null or p_attestation !~ '^[a-f0-9]{64}$' or v_signature is null or p_attestation<>v_signature then raise exception 'Invalid parser attestation' using errcode='22023'; end if;
  v_items:=p_items::jsonb;
  if jsonb_typeof(v_items) is distinct from 'array' then raise exception 'Invalid review selection' using errcode='22023'; end if;
  if jsonb_array_length(v_items) not between 1 and 50 then raise exception 'Invalid review selection' using errcode='22023'; end if;
  v_document_hash:=encode(extensions.digest(convert_to(replace(replace(p_markdown,E'\r\n',E'\n'),E'\r',E'\n'),'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('external-review:'||v_document_hash,0));
  -- Acquire the same sorted identity locks as manual/feed intake, before touching sources.
  for identity in select distinct x->>'identity' from jsonb_array_elements(v_items) x where x->>'identity' is not null order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended('source:'||identity,0));
  end loop;
  insert into academy.external_reviews(content_hash,document_hash,markdown,source_type,parser_version,imported_by)
    values(v_hash,v_document_hash,p_markdown,p_source_type,p_parser_version,auth.uid()) on conflict(document_hash) do nothing;
  select id into v_review from academy.external_reviews where document_hash=v_document_hash;
  for item in select * from jsonb_array_elements(v_items) loop
    extraction:=item->'extraction';identity:=item->>'identity';domain:=extraction->>'domain';
    if coalesce(item->>'key','') !~ '^section-[0-9]{1,2}$' or jsonb_typeof(extraction) is distinct from 'object'
      or extraction->>'verification' is distinct from 'unverified' or length(coalesce(extraction->>'title','')) not between 3 and 500
      or jsonb_typeof(extraction->'references') is distinct from 'array' or jsonb_typeof(extraction->'events') is distinct from 'array'
    then raise exception 'Invalid extracted item' using errcode='22023'; end if;
    -- Bound every new section, including future/pending imports. Legacy extraction is backfilled in full.
    if jsonb_array_length(extraction->'events')>20 then raise exception 'Too many reported events' using errcode='22023'; end if;
    -- Exact repeated selection is a no-op, including review reopen requests.
    if exists(select 1 from academy.external_review_items where review_id=v_review and item_key=item->>'key') then
      if exists(select 1 from academy.external_review_items i where i.review_id=v_review and i.item_key=item->>'key' and (i.selected_identity is distinct from identity or i.extraction is distinct from item->'extraction'))
      then raise exception 'Import selection conflicts with saved provenance' using errcode='22023'; end if;
      continue;
    end if;
    v_story:=null;v_source:=null;
    if identity is not null and domain in ('ai','physics') then
      if not exists(select 1 from jsonb_array_elements(extraction->'references') r where r->>'canonicalId'=identity and r->>'role'='primary_candidate')
      then raise exception 'Identity must be a selected publication reference' using errcode='22023'; end if;
      -- No title/topic matching or alias merging based on secondary report co-occurrence.
      v_story:=academy.create_candidate(identity,extraction->>'title',domain);
      select source_id into v_source from academy.source_aliases where alias=identity;
    end if;
    insert into academy.external_review_items(review_id,item_key,extraction,selected_identity,story_id,disposition,imported_by)
      values(v_review,item->>'key',extraction,identity,v_story,case when domain is null or domain not in ('ai','physics') then 'future_scope' when v_story is null then 'needs_identification' else 'linked' end,auth.uid()) returning id into v_item;
    v_added:=0;
    if v_story is not null then
      if jsonb_array_length(extraction->'events')>20 then raise exception 'Too many reported events' using errcode='22023'; end if;
      for event,v_ordinal in select value,ordinality from jsonb_array_elements(extraction->'events') with ordinality loop
        if event->>'referenceIdentity' is not null and event->>'referenceIdentity' is distinct from item->>'identity'
          and not exists(select 1 from academy.source_aliases where alias=event->>'referenceIdentity' and source_id=v_source) then continue; end if;
        v_kind:=event->>'kind';v_date:=(event->>'date')::date;
        if v_kind is null or v_kind not in ('initial_preprint','preprint_revision','journal_publication','experimental_result','independent_replication','correction','retraction','scientific_announcement') then raise exception 'Invalid scientific event' using errcode='22023'; end if;
        -- A verified alias may differ from the report identifier; use the existing source's work identity.
        select canonical_id into identity from academy.sources where id=v_source;
        -- Without a complete date or revision, a work/type pair is not a scientific event identity.
        -- Scope that uncertain observation to its immutable report item; retries reuse that item.
        event_key:=encode(extensions.digest(convert_to(identity||'|'||v_kind||'|'||coalesce(v_date::text,lower(event->>'reportedDate'),'')||'|'||coalesce(event->>'revision','')||case when v_date is null and event->>'revision' is null then '|item:'||v_item::text||'|observation:'||v_ordinal::text else '' end,'UTF8'),'sha256'),'hex');
        insert into academy.scientific_events(story_id,review_item_id,event_key,work_identity,kind,reported_date,reported_iso_date,revision,observation_index)
          values(v_story,v_item,event_key,identity,v_kind,left(event->>'reportedDate',500),v_date,(event->>'revision')::integer,v_ordinal::integer) on conflict do nothing;
        if found then v_added:=v_added+1; end if;
      end loop;
      if coalesce((item->>'reopen')::boolean,false) and v_added>0 then
        select editorial_version into v_version from academy.stories where id=v_story and status<>'published' for update;
        if found then perform academy.record_selection(v_story,'revise','External review reports a new scientific event; verify original sources before changing conclusions.',v_version,gen_random_uuid()); end if;
        -- Published revisions remain intact; needs_review events are visible in the import archive.
      end if;
    end if;
    perform academy.capture_review_observations(v_item);
  end loop;
  return v_review;
end $$;

create or replace function academy.ingest_candidate(p_token uuid,p_entry jsonb) returns uuid
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
  -- SCI-002: new DOI relationships require human confirmation.
  aliases:=array[canonical];
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
