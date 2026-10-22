begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
insert into auth.users(id,email) values
('04000000-0000-4000-8000-000000000001','editor-command@example.test'),
('04000000-0000-4000-8000-000000000002','reviewer-command@example.test'),
('04000000-0000-4000-8000-000000000003','outsider-command@example.test');
insert into academy.editor_members(user_id,role) values
('04000000-0000-4000-8000-000000000001','editor'),('04000000-0000-4000-8000-000000000002','reviewer');
select ok(not has_function_privilege('anon','academy.create_candidate(text,text,text)','execute'),'Anonymous cannot create candidates');
select ok(not has_table_privilege('authenticated','academy.editorial_decisions','insert'),'No direct decision writes');
set local role authenticated;
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000003',true);
select throws_ok($$select academy.create_candidate('arxiv:2401.12345','Synthetic command fixture','ai')$$,'42501',null,'Outsider cannot create');
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000002',true);
select throws_ok($$select academy.create_candidate('arxiv:2401.12345','Synthetic command fixture','ai')$$,'42501',null,'Reviewer cannot create');
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000001',true);
select throws_ok($$select academy.create_candidate('http://127.0.0.1/private','Bad target','ai')$$,'22023',null,'Arbitrary URL rejected');
select lives_ok($$select academy.create_candidate('arxiv:2401.12345','Synthetic command fixture','ai')$$,'Editor can create');
select is(academy.create_candidate('arxiv:2401.12345','Duplicate fixture','ai'), (select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'Duplicate candidate returns same story');
select is((select count(*) from academy.production_jobs where idempotency_key='normalize:arxiv:2401.12345'),1::bigint,'One normalization job');
select lives_ok($$select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'select','Suitable primary source',0,'05000000-0000-4000-8000-000000000001')$$,'Editor selects with authenticated actor');
select is((select actor_id from academy.editorial_decisions where request_id='05000000-0000-4000-8000-000000000001'),'04000000-0000-4000-8000-000000000001','Actor is auth.uid, not client input');
select lives_ok($$select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'select','Suitable primary source',0,'05000000-0000-4000-8000-000000000001')$$,'Retry returns previous decision despite old version');
select is((select editorial_version from academy.stories where slug='source-'||md5('arxiv:2401.12345')),1,'Retry does not increment version');
select throws_ok($$select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'reject','Changed payload',1,'05000000-0000-4000-8000-000000000001')$$,'22023',null,'Cannot reuse request ID for another decision');
select throws_ok($$select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'reject','Stale selection',0,'05000000-0000-4000-8000-000000000002')$$,'40001',null,'Stale tab cannot overwrite');
select throws_ok($$select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'approve','No publication bypass',1,'05000000-0000-4000-8000-000000000003')$$,'22023',null,'Selection RPC cannot approve publication');
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000002',true);
select throws_ok($$select academy.record_selection((select id from academy.stories where slug='source-'||md5('arxiv:2401.12345')),'reject','Reviewer cannot write',1,'05000000-0000-4000-8000-000000000004')$$,'42501',null,'Reviewer cannot decide');
reset role;
select * from finish();
rollback;
