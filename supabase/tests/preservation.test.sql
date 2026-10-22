begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
-- Local-only fixture: simulate a legacy application with a conflicting public table name.
create table public.sources(id text primary key, legacy_value text not null);
insert into public.sources values('legacy','keep-me');
select is((select legacy_value from public.sources where id='legacy'),'keep-me','Legacy public table survives Academy queries');
select ok(to_regclass('academy.sources') is not null,'Academy has its own source table');
select isnt('public.sources'::regclass::oid,'academy.sources'::regclass::oid,'Legacy and Academy tables are distinct objects');
select * from finish();
rollback;
