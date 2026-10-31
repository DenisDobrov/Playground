-- SCI-003. Local-first evidence foundation; no publication/Auth/legacy configuration changes.
create table academy.primary_documents (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references academy.sources,
 story_id uuid not null references academy.stories, snapshot_id uuid not null references academy.metadata_snapshots,
 version_label text not null, scope text not null check(scope in ('full_text','abstract_only')),
 source_url text not null, rights jsonb not null, checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 pages jsonb not null check(jsonb_typeof(pages)='array' and jsonb_array_length(pages) between 1 and 40 and octet_length(pages::text)<=1048576),
 text_hash text not null, extraction_method text not null, object_path text,
 actor_id uuid references auth.users, input_hash text not null unique, created_at timestamptz not null default now()
);
alter table academy.primary_documents add column intake_sequence bigint generated always as identity;
alter table academy.dossiers add column document_id uuid references academy.primary_documents,
 add column created_by uuid references auth.users, add column author_type text check(author_type in ('human','agent')),
 add column input_hash text, add column command_id uuid unique;
alter table academy.claims drop constraint claims_type_check;
alter table academy.editorial_decisions add column dossier_id uuid references academy.dossiers,
 add column research_input_hash text, add column research_review_ids uuid[];
alter table academy.claims add constraint claims_type_check check(type in ('measured_result','author_interpretation','theoretical_prediction','vendor_claim','editorial_explanation','speculation'));
alter table academy.claims add column local_key text, add column extraction_status text check(extraction_status in ('quote_matched','unsupported'));
alter table academy.evidence add column document_id uuid references academy.primary_documents,
 add column dossier_id uuid references academy.dossiers, add column page integer, add column local_key text,
 add column context text, add column numerical_results text, add column limitations text,
 add column extraction_method text, add column extraction_status text check(extraction_status='exact_quote_matched');
create table academy.scientific_reviews (
 id uuid primary key default gen_random_uuid(), dossier_id uuid not null references academy.dossiers,
 claim_id uuid not null references academy.claims, input_hash text not null, reviewer_id uuid not null references auth.users,
 version integer not null, previous_id uuid references academy.scientific_reviews,
 decision text not null check(decision in ('accept','narrow','reject','request_revision')),
 narrowed_text text, reason text not null check(length(trim(reason)) between 10 and 3000),
 effort_seconds integer not null check(effort_seconds between 0 and 86400),
 independent_verification text not null default 'not_performed' check(independent_verification='not_performed'),
 created_at timestamptz not null default now(), command_id uuid not null unique, unique(claim_id,version),
 check((decision='narrow' and narrowed_text is not null and length(trim(narrowed_text)) between 1 and 3000) or (decision<>'narrow' and narrowed_text is null))
);
create table academy.editorial_briefs (
 id uuid primary key default gen_random_uuid(), dossier_id uuid not null references academy.dossiers,
 review_ids uuid[] not null, content jsonb not null, input_hash text not null,
 preliminary boolean not null, created_by uuid not null references auth.users, created_at timestamptz not null default now(),
 unique(dossier_id,input_hash)
);
do $$ declare t text; begin
 foreach t in array array['primary_documents','scientific_reviews','editorial_briefs'] loop
 execute format('alter table academy.%I enable row level security',t);
 execute format('revoke all on academy.%I from public,anon,authenticated',t);
 execute format('grant select on academy.%I to authenticated',t);
 execute format('grant select on academy.%I to service_role',t);
 execute format('create policy member_read on academy.%I for select to authenticated using((select academy.is_editor()))',t);
 execute format('create trigger immutable before update or delete on academy.%I for each row execute function academy.external_review_immutable()',t);
 end loop;
end $$;
-- Existing service credentials stay trusted administrators, but ordinary worker table writes
-- must not fabricate a human scientific decision. Checked user RPCs run as their DB owner.
create function academy.guard_human_scientific_insert() returns trigger language plpgsql set search_path='' as $$ begin
 if current_user='service_role' then raise exception 'Worker cannot insert human scientific decisions' using errcode='42501'; end if;
 if tg_table_name='scientific_reviews' then
 if new.reviewer_id is distinct from auth.uid() then raise exception 'Scientific reviewer identity mismatch' using errcode='42501'; end if;
 else
 if new.actor_type is distinct from 'human' or new.actor_id is distinct from auth.uid()::text then raise exception 'Scientific approver identity mismatch' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger human_scientific_review before insert on academy.scientific_reviews for each row execute function academy.guard_human_scientific_insert();
create trigger human_scientific_approval before insert or update on academy.editorial_decisions for each row when(new.dossier_id is not null) execute function academy.guard_human_scientific_insert();
revoke all on function academy.guard_human_scientific_insert() from public,anon,authenticated,service_role;
-- Scientific content is immutable even while its independent-verification status remains unverified.
create trigger immutable_claims before update or delete on academy.claims for each row execute function academy.external_review_immutable();
create trigger immutable_evidence before update or delete on academy.evidence for each row execute function academy.external_review_immutable();
create trigger immutable_claim_evidence before update or delete on academy.claim_evidence for each row execute function academy.external_review_immutable();

create function academy.store_primary_document(p_snapshot uuid,p_story uuid,p_version text,p_scope text,p_url text,p_rights jsonb,p_checksum text,p_pages jsonb,p_method text,p_object text,p_actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s academy.metadata_snapshots; src uuid; v uuid; h text; begin
 select * into s from academy.metadata_snapshots where id=p_snapshot;
 select source_id into src from academy.source_aliases where alias=s.identity;
 if src is null or not exists(select 1 from academy.story_sources where story_id=p_story and source_id=src)
 or p_scope is null or p_scope not in ('full_text','abstract_only') or length(trim(coalesce(p_version,''))) not between 1 and 100
 or jsonb_typeof(p_pages) is distinct from 'array' or jsonb_array_length(p_pages) not between 1 and 40 or octet_length(p_pages::text)>1048576
 or exists(select 1 from jsonb_array_elements(p_pages) p where jsonb_typeof(p)<>'string')
 or coalesce(length(trim(p_rights->>'accessBasis')),0)<10 or coalesce(length(trim(p_rights->>'attribution')),0)<3
 or coalesce(length(trim(p_rights->>'reuseLicense')),0)=0 or p_checksum is null or p_checksum !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid primary document or identity' using errcode='22023'; end if;
 if s.provider='arxiv' and (p_version is distinct from 'v'||(s.normalized->>'version') or p_url not in ('https://arxiv.org/abs/'||substr(s.identity,7),'https://arxiv.org/abs/'||substr(s.identity,7)||p_version,'https://arxiv.org/pdf/'||substr(s.identity,7),'https://arxiv.org/pdf/'||substr(s.identity,7)||p_version)) then raise exception 'Document version/URL must match primary metadata' using errcode='22023'; end if;
 if s.provider='crossref' and p_url is distinct from 'https://doi.org/'||substr(s.identity,5) then raise exception 'Use canonical DOI source URL' using errcode='22023'; end if;
 if p_scope='abstract_only' and (jsonb_array_length(p_pages)<>1 or p_pages->>0 is distinct from s.normalized->>'abstract') then raise exception 'Abstract must match primary snapshot' using errcode='22023'; end if;
 if p_scope='full_text' and jsonb_array_length(p_pages)=1 and regexp_replace(trim(p_pages->>0),'\s+',' ','g')=regexp_replace(trim(s.normalized->>'abstract'),'\s+',' ','g') then raise exception 'Abstract content requires abstract_only scope' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('research-story:'||p_story::text,0));
 h:=encode(extensions.digest(convert_to(jsonb_build_array(p_snapshot,p_story,p_version,p_scope,p_url,p_rights,p_checksum,p_pages,p_method)::text,'UTF8'),'sha256'),'hex');
 insert into academy.primary_documents(source_id,story_id,snapshot_id,version_label,scope,source_url,rights,checksum,pages,text_hash,extraction_method,object_path,actor_id,input_hash)
 values(src,p_story,p_snapshot,p_version,p_scope,p_url,p_rights,p_checksum,p_pages,encode(extensions.digest(convert_to(p_pages::text,'UTF8'),'sha256'),'hex'),p_method,p_object,p_actor,h) on conflict(input_hash) do nothing;
 select id into v from academy.primary_documents where input_hash=h;return v;
end $$;
create function academy.save_primary_text(p_snapshot uuid,p_story uuid,p_version text,p_scope text,p_url text,p_rights jsonb,p_text text) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 perform academy.require_writing_editor();
 if p_text is null or octet_length(p_text) not between 1 and 262144 then raise exception 'Text limit: 256 KiB' using errcode='22023'; end if;
 return academy.store_primary_document(p_snapshot,p_story,p_version,p_scope,p_url,p_rights,encode(extensions.digest(convert_to(p_text,'UTF8'),'sha256'),'hex'),jsonb_build_array(p_text),'human_provided_text/1',null,auth.uid());
end $$;
create function academy.request_primary_pdf(p_snapshot uuid,p_story uuid,p_version text,p_url text,p_rights jsonb,p_object text) returns uuid
language plpgsql security definer set search_path='' as $$ declare payload jsonb; prior jsonb; begin
 perform academy.require_writing_editor();
 if p_object is null or p_object !~ ('^research-intake/'||auth.uid()::text||'/[a-f0-9-]{36}\.pdf$') or not exists(select 1 from storage.objects where bucket_id='dobrov-academy-assets' and name=p_object)
 then raise exception 'Upload owned PDF first' using errcode='22023'; end if;
 -- Final identity/version/rights checks and checksum are performed when the worker persists extraction.
 if not exists(select 1 from academy.metadata_snapshots m join academy.source_aliases a on a.alias=m.identity join academy.story_sources ss on ss.source_id=a.source_id where m.id=p_snapshot and ss.story_id=p_story) then raise exception 'Verified source required' using errcode='22023'; end if;
 payload:=jsonb_build_object('snapshot',p_snapshot,'story',p_story,'version',p_version,'url',p_url,'rights',p_rights,'object',p_object,'actor',auth.uid());
 perform pg_advisory_xact_lock(hashtextextended('pdf-intake:'||p_object,0));
 select j.payload into prior from academy.production_jobs j where j.idempotency_key='primary-pdf:'||p_object;
 if prior is not null and prior is distinct from payload then raise exception 'PDF request identity changed' using errcode='22023'; end if;
 return academy.enqueue_job('primary_document','primary-pdf:'||p_object,payload,p_story);
end $$;
create function academy.save_operator_pdf(p_snapshot uuid,p_story uuid,p_version text,p_url text,p_rights jsonb,p_checksum text,p_pages jsonb,p_object text) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 if p_object is distinct from 'research-operator/'||p_checksum||'.pdf' or not exists(select 1 from storage.objects where bucket_id='dobrov-academy-assets' and name=p_object) then raise exception 'Stored operator PDF required' using errcode='22023'; end if;
 return academy.store_primary_document(p_snapshot,p_story,p_version,'full_text',p_url,p_rights,p_checksum,p_pages,'operator_pdfjs_text_layer/1',p_object,null);
end $$;
create function academy.complete_primary_pdf(p_job uuid,p_lease uuid,p_checksum text,p_pages jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j academy.production_jobs; begin
 select * into j from academy.production_jobs where id=p_job and stage='primary_document' and status='running' and lease_token=p_lease and lease_expires_at>now() for update;
 if j.id is null or not exists(select 1 from academy.editor_members where user_id=(j.payload->>'actor')::uuid and role='editor') then raise exception 'Live lease and active editor required' using errcode='42501'; end if;
 return academy.store_primary_document((j.payload->>'snapshot')::uuid,j.story_id,j.payload->>'version','full_text',j.payload->>'url',j.payload->'rights',p_checksum,p_pages,'pdfjs_text_layer/1',j.payload->>'object',(j.payload->>'actor')::uuid);
end $$;
-- Narrow Storage policies affect only new SCI-003 paths in the existing private bucket.
create policy academy_research_upload on storage.objects for insert to authenticated with check(bucket_id='dobrov-academy-assets' and name ~ ('^research-intake/'||auth.uid()::text||'/[a-f0-9-]{36}\.pdf$') and exists(select 1 from academy.editor_members where user_id=auth.uid() and role='editor'));
create policy academy_research_read on storage.objects for select to authenticated using(bucket_id='dobrov-academy-assets' and (name like 'research-intake/'||auth.uid()::text||'/%' or exists(select 1 from academy.primary_documents d where d.object_path=name)) and (select academy.is_editor()));

create function academy.store_research_dossier(p_document uuid,p_draft jsonb,p_expected integer,p_command uuid,p_author uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare doc academy.primary_documents; prev academy.dossiers; prior academy.dossiers; v uuid; e jsonb; c jsonb; statement jsonb; k text;
 section_keys text[]:=array['scientificQuestion','background','methodology','mainFindings','quantitativeResults','supportingEvidence','limitations','alternativeInterpretations','demonstrated','unknowns','significance','openQuestions','sourceReferences'];
 ev uuid; cl uuid; domain text; h text; begin
 select * into doc from academy.primary_documents where id=p_document;
 if doc.id is null or p_command is null or p_draft is null or octet_length(p_draft::text)>262144 then raise exception 'Invalid research input' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('research-story:'||doc.story_id::text,0));
 h:=encode(extensions.digest(convert_to(jsonb_build_array(doc.id,doc.checksum,doc.text_hash,p_draft)::text,'UTF8'),'sha256'),'hex');
 select * into prior from academy.dossiers where command_id=p_command;
 if found then
 if prior.document_id<>p_document or prior.input_hash<>h or prior.created_by is distinct from p_author or prior.version-1 is distinct from p_expected then raise exception 'Research command conflict' using errcode='22023'; end if;
 return prior.id; end if;
 select * into prev from academy.dossiers where story_id=doc.story_id order by version desc limit 1;
 if p_expected is distinct from coalesce(prev.version,0) then raise exception 'Stale dossier revision' using errcode='40001'; end if;
 if jsonb_typeof(p_draft->'claims') is distinct from 'array' or jsonb_array_length(p_draft->'claims') not between 1 and 30 or jsonb_typeof(p_draft->'evidence') is distinct from 'array' or jsonb_array_length(p_draft->'evidence')>50 then raise exception 'Bounded claims/evidence required' using errcode='22023'; end if;
 if (select count(distinct x->>'key') from jsonb_array_elements(p_draft->'claims') x)<>jsonb_array_length(p_draft->'claims') or (select count(distinct x->>'key') from jsonb_array_elements(p_draft->'evidence') x)<>jsonb_array_length(p_draft->'evidence') then raise exception 'Duplicate identity' using errcode='22023'; end if;
 if jsonb_typeof(p_draft->'planning') is distinct from 'object' then raise exception 'Editorial planning required' using errcode='22023'; end if;
 foreach k in array array['angle','audience','whyMatters','novelty','headline'] loop
 if coalesce(length(trim(p_draft#>>array['planning',k])),0) not between 1 and 2000 then raise exception 'Editorial planning required' using errcode='22023'; end if;end loop;
 foreach k in array array['backgroundExplanations','relatedConcepts','potentialVisuals','openQuestions'] loop
 if jsonb_typeof(p_draft#>array['planning',k]) is distinct from 'array' or jsonb_array_length(p_draft#>array['planning',k])>20 then raise exception 'Bounded editorial planning required' using errcode='22023'; end if;end loop;
 foreach k in array section_keys loop
 if jsonb_typeof(p_draft#>array['sections',k]) is distinct from 'array' or jsonb_array_length(p_draft#>array['sections',k]) not between 1 and 30 then raise exception 'All thirteen dossier sections required' using errcode='22023'; end if;
 for statement in select * from jsonb_array_elements(p_draft#>array['sections',k]) loop
 if length(coalesce(statement->>'text','')) not between 1 and 4000 or coalesce(statement->>'provenance','') not in ('source_supported','author_interpretation','ai_explanation','unknown','disputed')
 or jsonb_typeof(statement->'claimKeys') is distinct from 'array' or (statement->>'provenance'='source_supported' and jsonb_array_length(statement->'claimKeys')=0)
 or exists(select 1 from jsonb_array_elements_text(statement->'claimKeys') r where not exists(select 1 from jsonb_array_elements(p_draft->'claims') cr(value) where cr.value->>'key'=r)) then raise exception 'Unmapped dossier statement' using errcode='22023'; end if;
 end loop;
 end loop;
 insert into academy.dossiers(story_id,version,content,document_id,created_by,author_type,input_hash,command_id)
 values(doc.story_id,coalesce(prev.version,0)+1,p_draft,doc.id,p_author,case when p_author is null then 'agent' else 'human' end,h,p_command) returning id into v;
 for e in select * from jsonb_array_elements(p_draft->'evidence') loop
 if coalesce(e->>'key','') !~ '^[a-z0-9-]{1,60}$' or length(coalesce(e->>'quote','')) not between 1 and 1500
 or (e->>'page')::integer not between 1 and jsonb_array_length(doc.pages) or coalesce(strpos(doc.pages->>((e->>'page')::integer-1),e->>'quote'),0)=0
 or coalesce(length(e->>'context'),0) not between 1 and 2000 or coalesce(length(e->>'limitations'),0) not between 1 and 2000
 then raise exception 'Quote or page not supported by document' using errcode='22023'; end if;
 insert into academy.evidence(source_id,quote,locator,document_id,dossier_id,page,local_key,context,numerical_results,limitations,extraction_method,extraction_status)
 values(doc.source_id,e->>'quote',case when doc.object_path is null then 'text segment ' else 'PDF page ' end||(e->>'page')||': '||coalesce(e->>'section',''),doc.id,v,(e->>'page')::integer,e->>'key',e->>'context',e->>'numericalResults',e->>'limitations','exact_substring/1','exact_quote_matched');
 end loop;
 for c in select * from jsonb_array_elements(p_draft->'claims') loop
 domain:=c->>'domainId';
 if coalesce(c->>'key','') !~ '^[a-z0-9-]{1,60}$' or length(coalesce(c->>'textEn','')) not between 1 and 3000
 or coalesce(c->>'type','') not in ('measured_result','author_interpretation','theoretical_prediction','editorial_explanation','speculation')
 or not exists(select 1 from academy.story_domains where story_id=doc.story_id and domain_id=domain)
 or not exists(select 1 from academy.domain_packs where id=domain and config->'evidenceLevels' ? (c->>'evidenceLevel'))
 or jsonb_typeof(c->'evidenceKeys') is distinct from 'array' or coalesce(length(c->>'caveatEn'),0) not between 1 and 2000
 or exists(select 1 from jsonb_array_elements_text(c->'evidenceKeys') r where not exists(select 1 from academy.evidence where dossier_id=v and local_key=r)) then raise exception 'Invalid scientific claim or domain policy' using errcode='22023'; end if;
 insert into academy.claims(dossier_id,domain_id,text_en,type,evidence_level,caveat_en,status,local_key,extraction_status)
 values(v,domain,c->>'textEn',c->>'type',c->>'evidenceLevel',c->>'caveatEn','unverified',c->>'key',case when jsonb_array_length(c->'evidenceKeys')=0 then 'unsupported' else 'quote_matched' end) returning id into cl;
 insert into academy.claim_evidence(claim_id,evidence_id) select cl,id from academy.evidence where dossier_id=v and local_key in (select jsonb_array_elements_text(c->'evidenceKeys'));
 end loop;
 return v;
end $$;
create function academy.save_research_dossier(p_document uuid,p_draft jsonb,p_expected integer,p_command uuid) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 perform academy.require_writing_editor();return academy.store_research_dossier(p_document,p_draft,p_expected,p_command,auth.uid());end $$;
create function academy.save_agent_dossier(p_document uuid,p_draft jsonb,p_expected integer,p_command uuid) returns uuid
language sql security definer set search_path='' as $$ select academy.store_research_dossier(p_document,p_draft,p_expected,p_command,null); $$;

create function academy.review_scientific_claim(p_claim uuid,p_decision text,p_reason text,p_narrowed text,p_expected integer,p_effort integer,p_command uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare c academy.claims; d academy.dossiers; prev academy.scientific_reviews; prior academy.scientific_reviews; v uuid; begin
 if not (select academy.is_editor()) then raise exception 'Editorial membership required' using errcode='42501'; end if;
 select * into c from academy.claims where id=p_claim;select * into d from academy.dossiers where id=c.dossier_id;
 if d.input_hash is null or d.created_by=auth.uid() then raise exception 'Independent human reviewer required' using errcode='42501'; end if;
 if p_command is null or p_decision is null or p_decision not in ('accept','narrow','reject','request_revision') or length(trim(coalesce(p_reason,''))) not between 10 and 3000 or p_effort is null or p_effort not between 0 and 86400 then raise exception 'Invalid scientific review' using errcode='22023'; end if;
 if (p_decision='narrow' and coalesce(length(trim(p_narrowed)),0) not between 1 and 3000) or (p_decision<>'narrow' and p_narrowed is not null) then raise exception 'Narrowed wording required only for narrow' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('research-story:'||d.story_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('claim-review:'||p_claim::text,0));
 select * into prior from academy.scientific_reviews where command_id=p_command;
 if found then
 if prior.claim_id<>p_claim or prior.reviewer_id<>auth.uid() or prior.decision<>p_decision or prior.reason<>p_reason or prior.narrowed_text is distinct from p_narrowed or prior.version-1 is distinct from p_expected or prior.effort_seconds<>p_effort then raise exception 'Review command conflict' using errcode='22023'; end if;
 return prior.id; end if;
 if exists(select 1 from academy.dossiers where story_id=d.story_id and version>d.version) then raise exception 'Review latest dossier revision' using errcode='40001'; end if;
 select * into prev from academy.scientific_reviews where claim_id=p_claim order by version desc limit 1;
 if p_expected is distinct from coalesce(prev.version,0) then raise exception 'Stale scientific review' using errcode='40001'; end if;
 if p_decision in ('accept','narrow') and (c.extraction_status<>'quote_matched' or not exists(select 1 from academy.claim_evidence where claim_id=p_claim)) then raise exception 'Unsupported claim cannot be approved' using errcode='22023'; end if;
 insert into academy.scientific_reviews(dossier_id,claim_id,input_hash,reviewer_id,version,previous_id,decision,narrowed_text,reason,effort_seconds,command_id)
 values(d.id,c.id,d.input_hash,auth.uid(),coalesce(prev.version,0)+1,prev.id,p_decision,p_narrowed,p_reason,p_effort,p_command) returning id into v;
 -- Never set claims.status=verified/narrowed: this review is not independent replication/verification.
 return v;
end $$;

create function academy.research_review_state(p_dossier uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d academy.dossiers; doc academy.primary_documents; missing integer; accepted integer; rejected integer; revisions integer; ids uuid[]; stale boolean; begin
 if not coalesce((select academy.is_editor()),false) and coalesce(auth.role(),'')<>'service_role' then raise exception 'Editorial membership required' using errcode='42501'; end if;
 select * into d from academy.dossiers where id=p_dossier; select * into doc from academy.primary_documents where id=d.document_id;
 if d.input_hash is null then raise exception 'Research dossier required' using errcode='22023'; end if;
 select count(*) filter(where r.id is null),count(*) filter(where r.decision in ('accept','narrow')),count(*) filter(where r.decision='reject'),count(*) filter(where r.decision='request_revision'),array_agg(r.id order by r.id) filter(where r.id is not null)
 into missing,accepted,rejected,revisions,ids from academy.claims c left join lateral(select * from academy.scientific_reviews where claim_id=c.id and input_hash=d.input_hash order by version desc limit 1) r on true where c.dossier_id=d.id;
 stale:=exists(select 1 from academy.dossiers where story_id=d.story_id and version>d.version) or exists(select 1 from academy.primary_documents where source_id=doc.source_id and intake_sequence>doc.intake_sequence);
 return jsonb_build_object('claimsReady',missing=0 and accepted>0 and revisions=0 and not stale,
 'ready',missing=0 and accepted>0 and revisions=0 and not stale and exists(select 1 from academy.editorial_decisions where dossier_id=d.id and decision='approve' and research_input_hash=d.input_hash and research_review_ids=ids and policy_version='scientific-dossier/1'),
 'missing',missing,'accepted',accepted,'rejected',rejected,'requestRevision',revisions,'stale',stale,'reviewIds',coalesce(to_jsonb(ids),'[]'::jsonb),'scope',doc.scope,'independentScientificVerification','not_performed');
end $$;
create function academy.create_editorial_brief(p_dossier uuid,p_preliminary boolean,p_expected_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d academy.dossiers; doc academy.primary_documents; state jsonb; content jsonb; findings jsonb; caveats jsonb; refs jsonb; v uuid; h text; begin
 perform academy.require_writing_editor();
 select * into d from academy.dossiers where id=p_dossier;select * into doc from academy.primary_documents where id=d.document_id;
 perform pg_advisory_xact_lock(hashtextextended('research-story:'||d.story_id::text,0));
 state:=academy.research_review_state(p_dossier);
 if p_expected_hash is distinct from d.input_hash or p_preliminary is null then raise exception 'Stale brief input' using errcode='40001'; end if;
 if not p_preliminary and not (state->>'ready')::boolean then raise exception 'Scientific review gate blocked' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('claimId',c.id,'text',case when r.decision='narrow' then r.narrowed_text else c.text_en end,'reviewId',r.id,'evidenceIds',(select coalesce(jsonb_agg(evidence_id),'[]') from academy.claim_evidence where claim_id=c.id)) order by c.local_key),'[]'),coalesce(jsonb_agg(c.caveat_en order by c.local_key),'[]') into findings,caveats
 from academy.claims c join lateral(select * from academy.scientific_reviews where claim_id=c.id and input_hash=d.input_hash order by version desc limit 1) r on r.decision in ('accept','narrow') where c.dossier_id=d.id;
 content:=jsonb_build_object('schema','editorial-brief/1','preliminary',p_preliminary,'dossierId',d.id,'dossierVersion',d.version,'documentId',doc.id,'documentChecksum',doc.checksum,'documentVersion',doc.version_label,'scope',doc.scope,
 'proposedAngle',d.content#>>'{planning,angle}','audience',d.content#>>'{planning,audience}',
 'whyItMatters',d.content#>>'{planning,whyMatters}','novelty',d.content#>>'{planning,novelty}',
 'approvedFindings',findings,'mandatoryCaveats',caveats||jsonb_build_array('No independent scientific verification or replication performed.',case when doc.scope='abstract_only' then 'ABSTRACT ONLY: methods, proofs and full-paper limitations were not inspected.' else 'Source-supported interpretation; not an independent reproduction.' end,'Document access does not establish figure/media reuse permission.'),
 'suggestedHeadline',case when p_preliminary then 'PRELIMINARY: ' else '' end||coalesce(d.content#>>'{planning,headline}','findings awaiting human review'),
 'backgroundExplanations',d.content#>'{planning,backgroundExplanations}','relatedConcepts',d.content#>'{planning,relatedConcepts}','potentialVisuals',d.content#>'{planning,potentialVisuals}',
 'openQuestions',d.content#>'{planning,openQuestions}','sourceReferences',jsonb_build_array(jsonb_build_object('sourceId',doc.source_id,'url',doc.source_url,'snapshotId',doc.snapshot_id,'version',doc.version_label)),
 'unsupportedClaimsExcluded',true,'independentScientificVerification','not_performed');
 h:=encode(extensions.digest(convert_to(jsonb_build_array(d.input_hash,state->'reviewIds',p_preliminary,content)::text,'UTF8'),'sha256'),'hex');
 insert into academy.editorial_briefs(dossier_id,review_ids,content,input_hash,preliminary,created_by) values(d.id,array(select jsonb_array_elements_text(state->'reviewIds')::uuid),content,h,p_preliminary,auth.uid()) on conflict(dossier_id,input_hash) do nothing;
 select id into v from academy.editorial_briefs where dossier_id=d.id and input_hash=h;return v;
end $$;
create function academy.approve_research_dossier(p_dossier uuid,p_hash text,p_reviews uuid[],p_reason text,p_command uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare d academy.dossiers; state jsonb; v uuid; prior academy.editorial_decisions; begin
 if not (select academy.is_editor()) then raise exception 'Editorial membership required' using errcode='42501'; end if;
 select * into d from academy.dossiers where id=p_dossier;
 if d.created_by=auth.uid() or d.input_hash is null then raise exception 'Independent human reviewer required' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 2000 or p_command is null then raise exception 'Approval reason required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('research-story:'||d.story_id::text,0));
 select * into prior from academy.editorial_decisions where request_id=p_command;
 if found then
 if prior.dossier_id is distinct from p_dossier or prior.actor_id<>auth.uid()::text or prior.reason<>p_reason or prior.research_input_hash is distinct from p_hash or prior.research_review_ids is distinct from p_reviews then raise exception 'Approval command conflict' using errcode='22023'; end if;
 return prior.id; end if;
 state:=academy.research_review_state(d.id);
 if not (state->>'claimsReady')::boolean or p_hash is distinct from d.input_hash or to_jsonb(p_reviews) is distinct from state->'reviewIds' then raise exception 'Current reviewed input required' using errcode='40001'; end if;
 if exists(select 1 from jsonb_each(d.content->'sections') ss cross join lateral jsonb_array_elements(ss.value) st(value)
 cross join lateral jsonb_array_elements_text(st.value->'claimKeys') ref(key)
 join academy.claims cl on cl.dossier_id=d.id and cl.local_key=ref.key
 left join lateral(select decision from academy.scientific_reviews where claim_id=cl.id and input_hash=d.input_hash order by version desc limit 1) rv on true
 where st.value->>'provenance' in ('source_supported','author_interpretation','ai_explanation') and rv.decision not in ('accept','narrow')) then raise exception 'Narrative references an unapproved claim' using errcode='22023'; end if;
 -- A whole-dossier approval covers scientific framing/planning, not just individual claim wording.
 insert into academy.editorial_decisions(story_id,actor_type,actor_id,decision,reason,policy_version,request_id,dossier_id,research_input_hash,research_review_ids)
 values(d.story_id,'human',auth.uid()::text,'approve',p_reason,'scientific-dossier/1',p_command,d.id,d.input_hash,p_reviews) returning id into v;return v;
end $$;
create trigger immutable_research_approval before update or delete on academy.editorial_decisions for each row when(old.dossier_id is not null) execute function academy.external_review_immutable();
revoke all on function academy.store_primary_document(uuid,uuid,text,text,text,jsonb,text,jsonb,text,text,uuid),academy.save_primary_text(uuid,uuid,text,text,text,jsonb,text),academy.request_primary_pdf(uuid,uuid,text,text,jsonb,text),academy.complete_primary_pdf(uuid,uuid,text,jsonb),academy.store_research_dossier(uuid,jsonb,integer,uuid,uuid),academy.save_research_dossier(uuid,jsonb,integer,uuid),academy.save_agent_dossier(uuid,jsonb,integer,uuid),academy.review_scientific_claim(uuid,text,text,text,integer,integer,uuid),academy.research_review_state(uuid),academy.create_editorial_brief(uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function academy.save_primary_text(uuid,uuid,text,text,text,jsonb,text),academy.request_primary_pdf(uuid,uuid,text,text,jsonb,text),academy.save_research_dossier(uuid,jsonb,integer,uuid),academy.review_scientific_claim(uuid,text,text,text,integer,integer,uuid),academy.research_review_state(uuid),academy.create_editorial_brief(uuid,boolean,text) to authenticated;
grant execute on function academy.complete_primary_pdf(uuid,uuid,text,jsonb),academy.save_agent_dossier(uuid,jsonb,integer,uuid) to service_role;
grant execute on function academy.research_review_state(uuid) to service_role;
revoke all on function academy.approve_research_dossier(uuid,text,uuid[],text,uuid) from public,anon,service_role;
grant execute on function academy.approve_research_dossier(uuid,text,uuid[],text,uuid) to authenticated;
revoke all on function academy.save_operator_pdf(uuid,uuid,text,text,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function academy.save_operator_pdf(uuid,uuid,text,text,jsonb,text,jsonb,text) to service_role;
notify pgrst,'reload schema';
