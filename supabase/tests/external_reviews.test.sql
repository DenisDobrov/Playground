begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
insert into auth.users(id,email) values
('09000000-0000-4000-8000-000000000001','import-editor@example.test'),
('09000000-0000-4000-8000-000000000002','import-reviewer@example.test');
insert into academy.editor_members(user_id,role) values
('09000000-0000-4000-8000-000000000001','editor'),('09000000-0000-4000-8000-000000000002','reviewer');
select ok(not has_table_privilege('anon','academy.external_reviews','select'),'Original reports are private');
select ok(not has_table_privilege('authenticated','academy.external_review_items','insert'),'No direct imported-item writes');
select set_config('test.review_payload','[
 {"key":"section-1","identity":"arxiv:9901.00001","reopen":true,"extraction":{"title":"Synthetic old work","domain":"physics","verification":"unverified","references":[{"canonicalId":"arxiv:9901.00001","role":"primary_candidate"},{"canonicalId":"doi:10.9999/new-journal-test","role":"primary_candidate"}],"events":[{"kind":"initial_preprint","reportedDate":"April 2025","date":null,"revision":null},{"kind":"journal_publication","reportedDate":"23 October 2026","date":"2026-10-23","revision":null},{"kind":"preprint_revision","date":null,"revision":3,"referenceIdentity":"arxiv:9901.00002"}]}},
 {"key":"section-2","identity":null,"extraction":{"title":"Future neuroscience fixture","domain":null,"verification":"unverified","references":[],"events":[]}},
 {"key":"section-3","identity":null,"extraction":{"title":"AI source needs identification","domain":"ai","verification":"unverified","references":[],"events":[]}}
]',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000002',true);
select throws_ok($$select academy.import_external_review('# SQL synthetic review','chatgpt','external-review/1',current_setting('test.review_payload')::jsonb)$$,'42501',null,'Reviewer cannot confirm imports');
select set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000001',true);
select academy.create_candidate('arxiv:9901.00001','Synthetic old work','physics');
select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:9901.00001')),'hold','Awaiting new scientific event',0,gen_random_uuid());
select lives_ok($$select academy.import_external_review('# SQL synthetic review','chatgpt','external-review/1',current_setting('test.review_payload')::jsonb)$$,'Import selected sections');
select is((select count(*) from academy.external_reviews where markdown='# SQL synthetic review'),1::bigint,'One immutable original');
select is((select count(*) from academy.external_review_items i join academy.external_reviews r on r.id=i.review_id where r.markdown='# SQL synthetic review'),3::bigint,'Selection includes active, future and pending sections');
select is((select count(*) from academy.external_review_items i join academy.external_reviews r on r.id=i.review_id where r.markdown='# SQL synthetic review' and disposition='future_scope' and story_id is null),1::bigint,'Unsupported topic does not enter active stories');
select is((select count(*) from academy.external_review_items i join academy.external_reviews r on r.id=i.review_id where r.markdown='# SQL synthetic review' and disposition='needs_identification' and story_id is null),1::bigint,'Missing primary source is preserved for manual identification');
select is((select count(*) from academy.sources where canonical_id='doi:10.9999/new-journal-test'),0::bigint,'Co-occurrence never merges or registers another paper as an alias');
select is((select status from academy.stories where slug='source-'||md5('arxiv:9901.00001')),'review','Explicit new-event review reopens the existing story');
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001'),2::bigint,'Older preprint and journal publication are different events');
select lives_ok($$select academy.import_external_review('# SQL synthetic review','chatgpt','external-review/1',current_setting('test.review_payload')::jsonb)$$,'Exact import retry is safe');
select is((select editorial_version from academy.stories where slug='source-'||md5('arxiv:9901.00001')),2,'Repeat does not reopen or rewrite decisions twice');
select is((select count(*) from academy.scientific_events where work_identity='arxiv:9901.00001' and verification='unverified'),2::bigint,'Events never become verified automatically');
select lives_ok($$select academy.import_external_review('# Independent work','external_review','external-review/1','[{"key":"section-1","identity":"doi:10.9999/independent-import-test","extraction":{"title":"Synthetic old work","domain":"physics","verification":"unverified","references":[{"canonicalId":"doi:10.9999/independent-import-test","role":"primary_candidate"}],"events":[]}}]')$$,'Independent work with the same title is accepted separately');
select is((select count(*) from academy.stories where title_en='Synthetic old work'),2::bigint,'No title-based merge');
reset role;
select throws_ok($$update academy.external_reviews set markdown='Changed' where markdown='# SQL synthetic review'$$,'23000',null,'Original review cannot be overwritten');
update academy.stories set status='published' where slug='source-'||md5('arxiv:9901.00001');
set local role authenticated;
select lives_ok($$select academy.import_external_review('# Correction report','chatgpt','external-review/1',jsonb_set(current_setting('test.review_payload')::jsonb,'{0,extraction,events}','[{"kind":"correction","reportedDate":null,"date":null,"revision":null}]'))$$,'Published story can receive a reported correction event');
select is((select status from academy.stories where slug='source-'||md5('arxiv:9901.00001')),'published','Reported events do not unpublish existing content');
select set_config('request.jwt.claim.sub','09000000-0000-4000-8000-000000000099',true);
select is((select count(*) from academy.external_reviews),0::bigint,'Outsider cannot read originals or import history');
reset role;
select * from finish();
rollback;
