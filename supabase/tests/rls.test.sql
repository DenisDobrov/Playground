begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
insert into auth.users(id,email) values
('01000000-0000-4000-8000-000000000001','reader@example.test'),
('01000000-0000-4000-8000-000000000002','editor@example.test');
insert into academy.editor_members(user_id,role) values('01000000-0000-4000-8000-000000000002','editor');
insert into academy.stories(id,slug,title_en) values('02000000-0000-4000-8000-000000000001','rls-fixture','Synthetic RLS fixture');
insert into academy.articles(story_id,version,slug,title_es,content,ai_disclosure_es,published_at) values
('02000000-0000-4000-8000-000000000001',1,'rls-fixture','Published fixture','{}','Synthetic',now()-interval '1 minute'),
('02000000-0000-4000-8000-000000000001',2,'rls-fixture','Draft fixture','{}','Synthetic',null);

set local role anon;
select is((select count(*) from academy.articles),1::bigint,'Anonymous sees only published article');
select throws_ok('select * from academy.production_jobs','42501',null,'Anonymous cannot read queue');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','01000000-0000-4000-8000-000000000001',true);
select is((select count(*) from academy.stories),0::bigint,'Signed-in reader sees no editorial story');
select is((select count(*) from academy.articles),1::bigint,'Signed-in reader sees no draft');
select set_config('request.jwt.claim.sub','01000000-0000-4000-8000-000000000002',true);
select is((select count(*) from academy.stories),1::bigint,'Editor sees story');
select is((select count(*) from academy.articles),2::bigint,'Editor sees both article versions');
select throws_ok($$insert into academy.stories(slug,title_en) values('unauthorized','Bad')$$,'42501',null,'Browser editor cannot bypass server-side writes');
reset role;
select throws_ok($$update academy.articles set title_es='Changed in place' where version=1$$,'P0001','Revisions are immutable; create a new version','Approved revisions are immutable');
select * from finish();
rollback;
