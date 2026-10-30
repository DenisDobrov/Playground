begin;
create extension if not exists pgtap with schema extensions;
select plan(32);
-- Test-only trusted signer: production has no RPC exposing this capability.
create function pg_temp.review_attestation(md text,source text,parser text,payload text,actor uuid) returns text
language sql security definer set search_path='' as $$
  select encode(extensions.hmac(convert_to('review-import/1'||E'\n'||actor::text||E'\n'||parser||E'\n'||source||E'\n'||encode(extensions.digest(convert_to(md,'UTF8'),'sha256'),'hex')||E'\n'||encode(extensions.digest(convert_to(payload,'UTF8'),'sha256'),'hex'),'UTF8'),secret,'sha256'),'hex')
  from academy.review_import_signing_key where id;
$$;
create function pg_temp.review_import(md text,source text,parser text,payload jsonb) returns uuid
language sql set search_path='' as $$ select academy.import_external_review(md,source,parser,payload::text,pg_temp.review_attestation(md,source,parser,payload::text,auth.uid())); $$;
insert into auth.users(id,email) values
('09000000-0000-4000-8000-000000000001','import-editor@example.test'),
('09000000-0000-4000-8000-000000000002','import-reviewer@example.test');
insert into academy.editor_members(user_id,role) values
('09000000-0000-4000-8000-000000000001','editor'),('09000000-0000-4000-8000-000000000002','reviewer');
select ok(not has_table_privilege('anon','academy.external_reviews','select'),'Original reports are private');
select ok(not has_table_privilege('authenticated','academy.external_review_items','insert'),'No direct imported-item writes');
select ok(to_regprocedure('academy.import_external_review(text,text,text,jsonb)') is null,'Unsigned legacy overload is not callable');
select set_config('test.review_payload','[
 {"key":"section-1","identity":"arxiv:9901.00001","reopen":true,"extraction":{"title":"Synthetic old work","domain":"physics","verification":"unverified","references":[{"canonicalId":"arxiv:9901.00001","role":"primary_candidate"},{"canonicalId":"doi:10.9999/new-journal-test","role":"primary_candidate"}],"events":[{"kind":"initial_preprint","reportedDate":"April 2025","date":null,"revision":null},{"kind":"journal_publication","reportedDate":"23 October 2026","date":"2026-10-23","revision":null},{"kind":"preprint_revision","date":null,"revision":3,"referenceIdentity":"arxiv:9901.00002"}]}},
 {"key":"section-2","identity":null,"extraction":{"title":"Future neuroscience fixture","domain":null,"verification":"unverified","references":[],"events":[]}},
 {"key":"section-3","identity":null,"extraction":{"title":"AI source needs identification","domain":"ai","verification":"unverified","references":[],"events":[]}}
]',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000002',true);
select throws_ok($$select pg_temp.review_import('# SQL synthetic review','chatgpt','external-review/1',current_setting('test.review_payload')::jsonb)$$,'42501',null,'Reviewer cannot confirm imports');
select set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000001',true);
select ok(not has_table_privilege('authenticated','academy.review_import_signing_key','select'),'Editor cannot read the parser signing key');
select throws_ok($$select academy.import_external_review('# Forged source','chatgpt','external-review/1',current_setting('test.review_payload'))$$,'22023','Invalid parser attestation','Direct editor cannot attribute forged extraction to Markdown');
select throws_ok($$select academy.import_external_review('# Modified source','chatgpt','external-review/1',current_setting('test.review_payload'),pg_temp.review_attestation('# Original source','chatgpt','external-review/1',current_setting('test.review_payload'),auth.uid()))$$,'22023','Invalid parser attestation','Attestation is bound to exact Markdown');
select throws_ok($$select academy.import_external_review('# Source','chatgpt','external-review/1',current_setting('test.review_payload')||' ',pg_temp.review_attestation('# Source','chatgpt','external-review/1',current_setting('test.review_payload'),auth.uid()))$$,'22023','Invalid parser attestation','Attestation is bound to exact extraction payload');
select throws_ok($$select academy.import_external_review('# Source','chatgpt','external-review/1',current_setting('test.review_payload'),pg_temp.review_attestation('# Source','chatgpt','external-review/1',current_setting('test.review_payload'),'09000000-0000-4000-8000-000000000099'))$$,'22023','Invalid parser attestation','Attestation cannot be replayed by another editor identity');
select academy.create_candidate('arxiv:9901.00001','Synthetic old work','physics');
select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:9901.00001')),'hold','Awaiting new scientific event',0,gen_random_uuid());
select lives_ok($$select pg_temp.review_import('# SQL synthetic review','chatgpt','external-review/1',current_setting('test.review_payload')::jsonb)$$,'Import selected sections');
select is((select count(*) from academy.external_reviews where markdown='# SQL synthetic review'),1::bigint,'One immutable original');
select is((select count(*) from academy.external_review_items i join academy.external_reviews r on r.id=i.review_id where r.markdown='# SQL synthetic review'),3::bigint,'Selection includes active, future and pending sections');
select is((select count(*) from academy.external_review_items i join academy.external_reviews r on r.id=i.review_id where r.markdown='# SQL synthetic review' and disposition='future_scope' and story_id is null),1::bigint,'Unsupported topic does not enter active stories');
select is((select count(*) from academy.external_review_items i join academy.external_reviews r on r.id=i.review_id where r.markdown='# SQL synthetic review' and disposition='needs_identification' and story_id is null),1::bigint,'Missing primary source is preserved for manual identification');
select is((select count(*) from academy.sources where canonical_id='doi:10.9999/new-journal-test'),0::bigint,'Co-occurrence never merges or registers another paper as an alias');
select is((select status from academy.stories where slug='source-'||md5('arxiv:9901.00001')),'review','Explicit new-event review reopens the existing story');
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001'),2::bigint,'Older preprint and journal publication are different events');
select lives_ok($$select pg_temp.review_import('# SQL synthetic review','chatgpt','external-review/1',current_setting('test.review_payload')::jsonb)$$,'Exact import retry is safe');
select throws_ok($$select pg_temp.review_import('# SQL synthetic review','chatgpt','external-review/1',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,title}','"Different extraction"'))$$,'22023','Import selection conflicts with saved provenance','Retry cannot silently bless an inconsistent legacy extraction');
select is((select editorial_version from academy.stories where slug='source-'||md5('arxiv:9901.00001')),2,'Repeat does not reopen or rewrite decisions twice');
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and verification='unverified'),2::bigint,'Events never become verified automatically');
select lives_ok($$select pg_temp.review_import('# Independent work','external_review','external-review/1','[{"key":"section-1","identity":"doi:10.9999/independent-import-test","extraction":{"title":"Synthetic old work","domain":"physics","verification":"unverified","references":[{"canonicalId":"doi:10.9999/independent-import-test","role":"primary_candidate"}],"events":[]}}]')$$,'Independent work with the same title is accepted separately');
select is((select count(*) from academy.stories where title_en='Synthetic old work'),2::bigint,'No title-based merge');
reset role;
select throws_ok($$update academy.external_reviews set markdown='Changed' where markdown='# SQL synthetic review'$$,'23000',null,'Original review cannot be overwritten');
update academy.stories set status='published' where slug='source-'||md5('arxiv:9901.00001');
set local role authenticated;
select lives_ok($$select pg_temp.review_import('# Correction report','chatgpt','external-review/1',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,events}','[{"kind":"correction","reportedDate":null,"date":null,"revision":null}]'))$$,'Published story can receive a reported correction event');
select is((select status from academy.stories where slug='source-'||md5('arxiv:9901.00001')),'published','Reported events do not unpublish existing content');
select set_config('test.undated_payload',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,events}','[{"kind":"correction","reportedDate":null,"date":null,"revision":null}]')::text,true);
select pg_temp.review_import('# Distinct undated correction A','chatgpt','external-review/1',current_setting('test.undated_payload')::jsonb);
select pg_temp.review_import('# Distinct undated correction B','chatgpt','external-review/1',current_setting('test.undated_payload')::jsonb);
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and kind='correction'),3::bigint,'Distinct undated corrections are not silently collapsed across reports');
select pg_temp.review_import('# Distinct undated correction B','chatgpt','external-review/1',current_setting('test.undated_payload')::jsonb);
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and kind='correction'),3::bigint,'Exact undated-event replay is still idempotent');
select pg_temp.review_import('# Same report distinct sections','chatgpt','external-review/1',jsonb_build_array((current_setting('test.undated_payload')::jsonb)->0,jsonb_set((current_setting('test.undated_payload')::jsonb)->0,'{key}','"section-4"')));
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and kind='correction'),5::bigint,'Undated events in distinct sections keep separate provenance');
select pg_temp.review_import('# Same dated event','chatgpt','external-review/1',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,events}','[{"kind":"journal_publication","date":"2026-10-23","reportedDate":"23 October 2026","revision":null}]'));
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and kind='journal_publication'),1::bigint,'Existing complete-date cross-report deduplication is retained');
select pg_temp.review_import('# Same revision A','chatgpt','external-review/1',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,events}','[{"kind":"preprint_revision","date":null,"reportedDate":null,"revision":4}]'));
select pg_temp.review_import('# Same revision B','chatgpt','external-review/1',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,events}','[{"kind":"preprint_revision","date":null,"reportedDate":null,"revision":4}]'));
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and kind='preprint_revision' and revision=4),1::bigint,'Stable revision cross-report deduplication is retained');
select set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000099',true);
select is((select count(*) from academy.external_reviews),0::bigint,'Outsider cannot read originals or import history');
reset role;
select * from finish();
rollback;
