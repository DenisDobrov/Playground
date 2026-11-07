-- SCI-004. Local only. Reuse immutable articles/scripts and the production ledger.
create table academy.content_receipts (
 id uuid primary key default gen_random_uuid(), operation_id uuid not null unique references academy.budget_operations,
 brief_id uuid not null references academy.editorial_briefs, kind text not null check(kind in ('article_es','article_en','script_es')),
 input_snapshot jsonb not null, response jsonb not null, response_hash text not null,
 audit jsonb not null, created_at timestamptz not null default now()
);
create table academy.content_drafts (
 id uuid primary key default gen_random_uuid(), receipt_id uuid not null unique references academy.content_receipts,
 story_id uuid not null references academy.stories, dossier_id uuid not null references academy.dossiers,
 brief_id uuid not null references academy.editorial_briefs, kind text not null,
 article_id uuid unique references academy.articles, script_id uuid unique references academy.scripts,
 payload jsonb not null, output_hash text not null, input_hash text not null, issues jsonb not null,
 created_at timestamptz not null default now(), check((article_id is null)<>(script_id is null))
);
create table academy.content_reviews (
 id uuid primary key default gen_random_uuid(), draft_id uuid not null references academy.content_drafts,
 reviewer_id uuid not null references auth.users, output_hash text not null, input_hash text not null,
 version integer not null, previous_id uuid references academy.content_reviews, command_id uuid not null unique,
 decision text not null check(decision in ('approve','request_revision','reject')), reason text not null,
 checks jsonb not null, created_at timestamptz not null default now(), unique(draft_id,version)
);
do $$ declare t text; begin
 foreach t in array array['content_receipts','content_drafts','content_reviews'] loop
 execute format('alter table academy.%I enable row level security',t);
 execute format('revoke all on academy.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on academy.%I to authenticated,service_role',t);
 execute format('create policy members_read on academy.%I for select to authenticated using (academy.is_editor())',t);
 execute format('create trigger immutable_content before update or delete on academy.%I for each row execute function academy.external_review_immutable()',t);
 end loop;
end $$;

create function academy.content_generation_input(p_brief uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b academy.editorial_briefs; d academy.dossiers; doc academy.primary_documents; state jsonb; result jsonb; approval uuid; begin
 if not coalesce(academy.is_editor(),false) and coalesce(auth.role(),'')<>'service_role' then raise exception 'Editorial membership required' using errcode='42501'; end if;
 select * into b from academy.editorial_briefs where id=p_brief;select * into d from academy.dossiers where id=b.dossier_id;
 if b.id is null or b.preliminary then raise exception 'Approved brief required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('research-story:'||d.story_id::text,0));
 state:=academy.research_review_state(d.id);
 if not (state->>'ready')::boolean or to_jsonb(b.review_ids) is distinct from state->'reviewIds' then raise exception 'Stale or unapproved evidence package' using errcode='40001'; end if;
 select * into doc from academy.primary_documents where id=d.document_id;
 select id into approval from academy.editorial_decisions where dossier_id=d.id and decision='approve' and research_input_hash=d.input_hash and research_review_ids=b.review_ids and policy_version='scientific-dossier/1' order by created_at,id limit 1;
 result:=jsonb_build_object('schema','content-input/1','storyId',d.story_id,'dossierId',d.id,'dossierVersion',d.version,'dossierHash',d.input_hash,'briefId',b.id,'briefHash',b.input_hash,'approvalId',approval,'reviewIds',state->'reviewIds','brief',b.content,
 'dossier',d.content,'document',jsonb_build_object('id',doc.id,'checksum',doc.checksum,'scope',doc.scope,'version',doc.version_label,'rights',doc.rights),
 'evidence',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'quote',e.quote,'numericalResults',e.numerical_results,'locator',e.locator,'sourceId',e.source_id) order by e.id),'[]') from academy.evidence e where e.dossier_id=d.id and exists(select 1 from academy.claim_evidence ce join academy.scientific_reviews r on r.claim_id=ce.claim_id and r.id=any(b.review_ids) and r.decision in ('accept','narrow') where ce.evidence_id=e.id)),
 'independentScientificVerification','not_performed');
 return result||jsonb_build_object('inputHash',encode(extensions.digest(convert_to(result::text,'UTF8'),'sha256'),'hex'));
end $$;

create function academy.record_content_receipt(p_operation uuid,p_brief uuid,p_input_hash text,p_kind text,p_response jsonb,p_audit jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare input jsonb; op academy.budget_operations; prior academy.content_receipts; h text; v uuid; begin
 input:=academy.content_generation_input(p_brief);
 if input->>'inputHash' is distinct from p_input_hash or p_kind is null or p_kind not in ('article_es','article_en','script_es') then raise exception 'Current content input required' using errcode='40001'; end if;
 select * into op from academy.budget_operations where id=p_operation for update;
 if op.id is null or op.state not in ('started','uncertain','settled') or op.story_id is distinct from (input->>'storyId')::uuid or op.category<>'content' or op.tool<>'content-'||p_kind or op.input_hash is distinct from p_audit->>'requestHash' or op.price_version is distinct from p_audit->>'priceVersion' then raise exception 'Dispatched content ledger operation required' using errcode='22023'; end if;
 if jsonb_typeof(p_response) is distinct from 'object' or octet_length(p_response::text)>1048576 or jsonb_typeof(p_response->'text') is distinct from 'string' or length(coalesce(p_audit->>'model',''))=0 or length(coalesce(p_audit->>'promptVersion',''))=0 or jsonb_typeof(p_response->'usage') is distinct from 'object' or length(coalesce(p_response->>'receipt',''))=0 then raise exception 'Bounded provider response and provenance required' using errcode='22023'; end if;
 h:=encode(extensions.digest(convert_to(p_response::text,'UTF8'),'sha256'),'hex');
 select * into prior from academy.content_receipts where operation_id=p_operation;
 if found then
 if prior.brief_id<>p_brief or prior.kind<>p_kind or prior.response is distinct from p_response or prior.audit is distinct from p_audit then raise exception 'Receipt replay conflict' using errcode='22023'; end if;return prior.id;end if;
 insert into academy.content_receipts(operation_id,brief_id,kind,input_snapshot,response,response_hash,audit) values(p_operation,p_brief,p_kind,input,p_response,h,p_audit) returning id into v;return v;
end $$;

-- Structural flags do not assert semantic equivalence. A human must inspect every mapping and translation.
create function academy.content_draft_issues(p_kind text,p jsonb,i jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare issues jsonb:='[]'; row jsonb; scene jsonb; ref text; section jsonb; rows jsonb:='[]'; numeric_rows jsonb:='[]'; source_numbers numeric[]; seen text[]:='{}'; covered text[]:='{}'; main_claims text[]:='{}'; main_caveats text[]:='{}'; dur integer:=0; total integer:=0; words integer:=0; n integer; begin
 if jsonb_typeof(p) is distinct from 'object' or p->>'language' is distinct from (case when p_kind='article_en' then 'en' else 'es' end) or length(trim(coalesce(p->>'title','')))=0 or length(trim(coalesce(p->>'aiDisclosure','')))=0 or jsonb_typeof(p->'unsupportedStatements') is distinct from 'array' then raise exception 'Invalid content schema' using errcode='22023'; end if;
 if jsonb_array_length(p->'unsupportedStatements')>0 then issues:=issues||'"model_reported_unsupported_statement"';end if;
 if p_kind='script_es' then
 if jsonb_typeof(p->'scenes') is distinct from 'array' or jsonb_array_length(p->'scenes') not between 4 and 30 then raise exception 'Bounded scene list required' using errcode='22023';end if;
 for scene in select value from jsonb_array_elements(p->'scenes') loop
 if scene->>'id'=any(seen) then issues:=issues||'"duplicate_scene"';end if;seen:=array_append(seen,scene->>'id');
 if scene->>'type' not in ('scientific_diagram','research_evidence','concept_visualization','presenter_insert','scientific_caveat') or coalesce(scene->>'durationEstimateSeconds','')!~'^[0-9]{1,3}$' or (scene->>'durationEstimateSeconds')::integer not between 1 and 120 then raise exception 'Invalid scene type/timing' using errcode='22023';end if;
 total:=total+(scene->>'durationEstimateSeconds')::integer;
 rows:=rows||jsonb_build_array(jsonb_build_object('text',scene->>'narrationEs','claimIds',scene->'sourceClaimIds','caveatIds',scene->'caveatIds'));
 if scene->>'type'<>'presenter_insert' then
 dur:=dur+(scene->>'durationEstimateSeconds')::integer;
 words:=words+cardinality(regexp_split_to_array(trim(scene->>'narrationEs'),'\s+'));
 main_claims:=main_claims||array(select jsonb_array_elements_text(scene->'sourceClaimIds'));
 main_caveats:=main_caveats||array(select jsonb_array_elements_text(scene->'caveatIds'));
 end if;
 if scene->>'type'='concept_visualization' and length(trim(coalesce(scene->>'explanatoryLabelEs','')))=0 then issues:=issues||'"illustration_disclosure_required"';end if;
 end loop;
 if dur<360 or total>480 or words not between 780 and 1200 then issues:=issues||'"script_duration_estimate_outside_pilot"';end if;
 if not exists(select 1 from jsonb_array_elements(p->'scenes') s where s->>'type'='scientific_caveat') then issues:=issues||'"caveat_scene_required"';end if;
 for scene in select value from jsonb_array_elements(p->'scenes') where value->>'type'='presenter_insert' loop
 if (scene->>'durationEstimateSeconds')::integer>8 or exists(select 1 from jsonb_array_elements_text(scene->'sourceClaimIds') r where not (r=any(main_claims))) or exists(select 1 from jsonb_array_elements_text(scene->'caveatIds') r where not (r=any(main_caveats))) then issues:=issues||'"presenter_not_optional"';end if;end loop;
 if exists(select 1 from jsonb_array_elements(i#>'{brief,approvedFindings}') f where not (f->>'claimId'=any(main_claims))) then issues:=issues||'"main_video_missing_claim"';end if;
 else
 if jsonb_typeof(p->'sections') is distinct from 'array' or jsonb_array_length(p->'sections')<>8 then raise exception 'Eight article sections required' using errcode='22023';end if;
 for section in select value from jsonb_array_elements(p->'sections') loop
 if section->>'key'=any(seen) or section->>'key' not in ('scientific_question','background','methods','results','significance','limitations','remaining_questions','original_sources') then issues:=issues||'"missing_article_section"';end if;seen:=array_append(seen,section->>'key');
 if jsonb_typeof(section->'paragraphs') is distinct from 'array' or jsonb_array_length(section->'paragraphs') not between 1 and 12 then raise exception 'Bounded paragraphs required' using errcode='22023';end if;
 rows:=rows||(section->'paragraphs');if section->>'key'<>'original_sources' then numeric_rows:=numeric_rows||(section->'paragraphs');end if;end loop;
 end if;
 if p_kind='script_es' then numeric_rows:=rows;end if;
 select array_agg(replace(m[1],',','.')::numeric) into source_numbers from regexp_matches((select coalesce(string_agg(t,' '),'') from (select f->>'text' t from jsonb_array_elements(i#>'{brief,approvedFindings}') f union all select coalesce(e->>'quote','')||' '||coalesce(e->>'numericalResults','') from jsonb_array_elements(i->'evidence') e) texts),'([0-9]+(?:[.,][0-9]+)?)','g') m;
 if exists(select 1 from jsonb_array_elements(numeric_rows) r cross join lateral regexp_matches(r->>'text','([0-9]+(?:[.,][0-9]+)?)','g') m where not (replace(m[1],',','.')::numeric=any(coalesce(source_numbers,'{}'::numeric[])))) then issues:=issues||'"unverified_quantity"';end if;
 for row in select value from jsonb_array_elements(rows) loop
 if length(trim(coalesce(row->>'text',''))) not between 1 and 5000 or jsonb_typeof(row->'claimIds') is distinct from 'array' or jsonb_typeof(row->'caveatIds') is distinct from 'array' then raise exception 'Mapped text required' using errcode='22023';end if;
 if jsonb_array_length(row->'claimIds')=0 then issues:=issues||'"unmapped_assertion"';end if;
 for ref in select jsonb_array_elements_text(row->'claimIds') loop
 if not exists(select 1 from jsonb_array_elements(i#>'{brief,approvedFindings}') f where f->>'claimId'=ref) then issues:=issues||'"unapproved_claim"';end if;end loop;
 for ref in select jsonb_array_elements_text(row->'caveatIds') loop
 if ref!~'^caveat-[0-9]{1,2}$' or substring(ref from 8)::integer>=jsonb_array_length(i#>'{brief,mandatoryCaveats}') then issues:=issues||'"unknown_caveat"';end if;covered:=array_append(covered,ref);end loop;
 end loop;
 for n in 0..jsonb_array_length(i#>'{brief,mandatoryCaveats}')-1 loop
 if not ('caveat-'||n=any(covered)) then issues:=issues||'"missing_mandatory_caveat"';end if;
 if p_kind='script_es' and not ('caveat-'||n=any(main_caveats)) then issues:=issues||'"main_video_missing_caveat"';end if;end loop;
 return (select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements(issues));
end $$;

create function academy.save_content_draft(p_receipt uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r academy.content_receipts; op academy.budget_operations; input jsonb; p jsonb; flags jsonb; h text; v uuid; artifact uuid; ver integer; begin
 select * into r from academy.content_receipts where id=p_receipt;if r.id is null then raise exception 'Receipt required' using errcode='22023';end if;
 input:=academy.content_generation_input(r.brief_id);
 if input->>'inputHash' is distinct from r.input_snapshot->>'inputHash' then raise exception 'Stale generation result' using errcode='40001';end if;
 select id into v from academy.content_drafts where receipt_id=r.id;if found then return v;end if;
 select * into op from academy.budget_operations where id=r.operation_id;
 if op.state<>'settled' or op.external_ref is distinct from 'content-receipt:'||r.id::text then raise exception 'Settle provider usage before saving draft' using errcode='22023';end if;
 p:=(r.response->>'text')::jsonb;flags:=academy.content_draft_issues(r.kind,p,input);
 h:=encode(extensions.digest(convert_to(p::text,'UTF8'),'sha256'),'hex');
 if r.kind='script_es' then
 select coalesce(max(version),0)+1 into ver from academy.scripts where story_id=(input->>'storyId')::uuid;
 insert into academy.scripts(story_id,version,scenes) values((input->>'storyId')::uuid,ver,p->'scenes') returning id into artifact;
 else
 select coalesce(max(version),0)+1 into ver from academy.articles where story_id=(input->>'storyId')::uuid and language=p->>'language';
 insert into academy.articles(story_id,version,slug,title_es,content,ai_disclosure_es,language) values((input->>'storyId')::uuid,ver,'draft-'||r.id,p->>'title',p,p->>'aiDisclosure',p->>'language') returning id into artifact;
 end if;
 insert into academy.content_drafts(receipt_id,story_id,dossier_id,brief_id,kind,article_id,script_id,payload,output_hash,input_hash,issues)
 values(r.id,(input->>'storyId')::uuid,(input->>'dossierId')::uuid,r.brief_id,r.kind,case when r.kind<>'script_es' then artifact end,case when r.kind='script_es' then artifact end,p,h,input->>'inputHash',flags) returning id into v;return v;
end $$;

create function academy.review_content_draft(p_draft uuid,p_hash text,p_input_hash text,p_decision text,p_checks jsonb,p_reason text,p_expected integer,p_command uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare d academy.content_drafts; input jsonb; prev academy.content_reviews; prior academy.content_reviews; v uuid; begin
 if not coalesce(academy.is_editor(),false) then raise exception 'Human editorial membership required' using errcode='42501';end if;
 select * into d from academy.content_drafts where id=p_draft;
 input:=academy.content_generation_input(d.brief_id);
 if d.output_hash is distinct from p_hash or d.input_hash is distinct from p_input_hash or input->>'inputHash' is distinct from d.input_hash then raise exception 'Current exact content revision required' using errcode='40001';end if;
 if p_decision is null or p_decision not in ('approve','request_revision','reject') or length(trim(coalesce(p_reason,''))) not between 10 and 3000 or p_command is null then raise exception 'Invalid content review' using errcode='22023';end if;
 if p_decision='approve' and (d.issues<>'[]'::jsonb or not coalesce((p_checks->>'claimAlignment')::boolean,false) or not coalesce((p_checks->>'languageQuality')::boolean,false) or not coalesce((p_checks->>'scientificCaveats')::boolean,false) or not coalesce((p_checks->>'quantitativeValues')::boolean,false)) then raise exception 'Resolve flags and inspect all review dimensions' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('content-review:'||d.id::text,0));
 select * into prior from academy.content_reviews where command_id=p_command;
 if found then
 if prior.draft_id<>p_draft or prior.reviewer_id<>auth.uid() or prior.output_hash<>p_hash or prior.input_hash<>p_input_hash or prior.decision<>p_decision or prior.checks is distinct from p_checks or prior.reason<>p_reason or prior.version-1 is distinct from p_expected then raise exception 'Review replay conflict' using errcode='22023';end if;return prior.id;end if;
 select * into prev from academy.content_reviews where draft_id=d.id order by version desc limit 1;
 if p_expected is distinct from coalesce(prev.version,0) then raise exception 'Stale review version' using errcode='40001';end if;
 insert into academy.content_reviews(draft_id,reviewer_id,output_hash,input_hash,version,previous_id,command_id,decision,reason,checks) values(d.id,auth.uid(),p_hash,p_input_hash,coalesce(prev.version,0)+1,prev.id,p_command,p_decision,p_reason,p_checks) returning id into v;return v;
end $$;

revoke all on function academy.content_generation_input(uuid),academy.record_content_receipt(uuid,uuid,text,text,jsonb,jsonb),academy.content_draft_issues(text,jsonb,jsonb),academy.save_content_draft(uuid),academy.review_content_draft(uuid,text,text,text,jsonb,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function academy.content_generation_input(uuid) to authenticated,service_role;
grant execute on function academy.record_content_receipt(uuid,uuid,text,text,jsonb,jsonb),academy.save_content_draft(uuid) to service_role;
grant execute on function academy.review_content_draft(uuid,text,text,text,jsonb,text,integer,uuid) to authenticated;
