-- SCI-001 final review: keep installed 009 immutable; no Auth/legacy/publishing changes.
-- Dedicated parser-attestation key; no authenticated/anonymous access or signing RPC.
create table if not exists academy.review_import_signing_key (
  id boolean primary key default true check(id),
  secret bytea not null check(octet_length(secret)=32)
);
alter table academy.review_import_signing_key enable row level security;
revoke all on academy.review_import_signing_key from public,anon,authenticated;
grant select on academy.review_import_signing_key to service_role;
insert into academy.review_import_signing_key(secret) values(extensions.gen_random_bytes(32)) on conflict(id) do nothing;

-- One authenticated command confirms a bounded selection; no web service-role client.
drop function if exists academy.import_external_review(text,text,text,jsonb);
create or replace function academy.import_external_review(p_markdown text,p_source_type text,p_parser_version text,p_items text,p_attestation text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_hash text; v_document_hash text; v_review uuid; item jsonb; extraction jsonb; event jsonb;
  v_item uuid; v_story uuid; v_source uuid; identity text; domain text; matches integer;
  event_key text; v_kind text; v_date date; v_added integer; v_version integer; v_items jsonb; v_signature text;
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
      for event in select * from jsonb_array_elements(extraction->'events') loop
        if event->>'referenceIdentity' is not null and event->>'referenceIdentity' is distinct from item->>'identity'
          and not exists(select 1 from academy.source_aliases where alias=event->>'referenceIdentity' and source_id=v_source) then continue; end if;
        v_kind:=event->>'kind';v_date:=(event->>'date')::date;
        if v_kind is null or v_kind not in ('initial_preprint','preprint_revision','journal_publication','experimental_result','independent_replication','correction','retraction','scientific_announcement') then raise exception 'Invalid scientific event' using errcode='22023'; end if;
        -- A verified alias may differ from the report identifier; use the existing source's work identity.
        select canonical_id into identity from academy.sources where id=v_source;
        -- Without a complete date or revision, a work/type pair is not a scientific event identity.
        -- Scope that uncertain observation to its immutable report item; retries reuse that item.
        event_key:=encode(extensions.digest(convert_to(identity||'|'||v_kind||'|'||coalesce(v_date::text,lower(event->>'reportedDate'),'')||'|'||coalesce(event->>'revision','')||case when v_date is null and event->>'revision' is null then '|item:'||v_item::text else '' end,'UTF8'),'sha256'),'hex');
        insert into academy.scientific_events(story_id,review_item_id,event_key,work_identity,kind,reported_date,reported_iso_date,revision)
          values(v_story,v_item,event_key,identity,v_kind,left(event->>'reportedDate',500),v_date,(event->>'revision')::integer) on conflict do nothing;
        if found then v_added:=v_added+1; end if;
      end loop;
      if coalesce((item->>'reopen')::boolean,false) and v_added>0 then
        select editorial_version into v_version from academy.stories where id=v_story and status<>'published' for update;
        if found then perform academy.record_selection(v_story,'revise','External review reports a new scientific event; verify original sources before changing conclusions.',v_version,gen_random_uuid()); end if;
        -- Published revisions remain intact; needs_review events are visible in the import archive.
      end if;
    end if;
  end loop;
  return v_review;
end $$;
revoke all on function academy.external_review_immutable(),academy.import_external_review(text,text,text,text,text) from public,anon,service_role;
grant execute on function academy.import_external_review(text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';

-- Preserve event UUIDs/lineage while scoping legacy undated observations to their existing source item.
update academy.scientific_events set event_key=encode(extensions.digest(convert_to(work_identity||'|'||kind||'|'||coalesce(reported_iso_date::text,lower(reported_date),'')||'|'||coalesce(revision::text,'')||'|item:'||review_item_id::text,'UTF8'),'sha256'),'hex') where reported_iso_date is null and revision is null;
