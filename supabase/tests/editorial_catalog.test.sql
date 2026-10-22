begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(id,email) values
('07000000-0000-4000-8000-000000000001','catalog-reviewer@example.test'),
('07000000-0000-4000-8000-000000000002','catalog-outsider@example.test');
insert into academy.editor_members(user_id,role) values ('07000000-0000-4000-8000-000000000001','reviewer');
insert into academy.stories(id,slug,title_en,status,editorial_version) values
('07000000-0000-4000-8000-000000000003','catalog-test-fixture','Synthetic catalog fixture','review',2);
insert into academy.story_domains(story_id,domain_id) values ('07000000-0000-4000-8000-000000000003','ai');
insert into academy.editorial_decisions(story_id,actor_type,actor_id,decision,reason,policy_version,created_at) values
('07000000-0000-4000-8000-000000000003','human','fixture','reject','Original weak evidence','selection/1','2026-10-20'),
('07000000-0000-4000-8000-000000000003','human','fixture','revise','New replication available','selection/1','2026-10-21'),
('07000000-0000-4000-8000-000000000003','agent','fixture','select','Agent preference','selection/1','2026-10-22');
select ok(not has_table_privilege('anon','academy.editorial_catalog','select'),'Anonymous cannot read catalog');
select ok(not has_table_privilege('authenticated','academy.editorial_catalog','update'),'Catalog is read-only');
set local role authenticated;
select set_config('request.jwt.claim.sub','07000000-0000-4000-8000-000000000002',true);
select is((select count(*) from academy.editorial_catalog),0::bigint,'Security-invoker view respects outsider RLS');
select set_config('request.jwt.claim.sub','07000000-0000-4000-8000-000000000001',true);
select is((select latest_decision from academy.editorial_catalog where id='07000000-0000-4000-8000-000000000003'),'revise','Agent vote does not replace latest human decision');
select is((select count(*) from academy.editorial_catalog where id='07000000-0000-4000-8000-000000000003' and domain_ids @> array['ai']),1::bigint,'Reviewer can filter by area');
select is((select count(*) from academy.editorial_catalog where id='07000000-0000-4000-8000-000000000003' and search_text ilike '%original weak evidence%'),1::bigint,'Earlier reasons remain searchable');
select is((select count(*) from academy.editorial_catalog where id='07000000-0000-4000-8000-000000000003' and search_text ilike '%new replication%'),1::bigint,'Latest motive is searchable');
select is((select count(*) from academy.editorial_catalog where id='07000000-0000-4000-8000-000000000003' and editorial_version=0 and status='candidate'),0::bigint,'Decided story does not re-enter new queue');
reset role;
delete from academy.editor_members where user_id='07000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*) from academy.editorial_catalog),0::bigint,'Membership revocation removes access to search text');
reset role;
select * from finish();
rollback;
