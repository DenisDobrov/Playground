-- Apply with Supabase CLI. Private editorial data is never readable by anon.
create schema academy;
revoke all on schema academy from public;
grant usage on schema academy to anon, authenticated, service_role;
alter default privileges in schema academy revoke execute on functions from public;

create table academy.editor_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'reviewer')), created_at timestamptz not null default now()
);
create function academy.is_editor() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from academy.editor_members where user_id = (select auth.uid()));
$$;
revoke all on function academy.is_editor() from public;
grant execute on function academy.is_editor() to authenticated;

create table academy.domain_packs (
  id text primary key, version text not null, config jsonb not null,
  autonomy text not null default 'shadow' check (autonomy in ('shadow','full_audit','sampling'))
);
create table academy.sources (
  id uuid primary key default gen_random_uuid(), canonical_id text not null unique,
  url text not null, title_en text not null, kind text not null,
  peer_reviewed boolean not null default false, full_text_available boolean not null default false,
  license text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table academy.stories (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  title_en text not null, status text not null default 'candidate'
    check(status in ('candidate','researching','review','published','held')),
  score numeric check(score between 0 and 100), score_reason_en text,
  created_at timestamptz not null default now()
);
create table academy.story_domains (
  story_id uuid references academy.stories on delete cascade, domain_id text references academy.domain_packs,
  primary key(story_id,domain_id)
);
create table academy.story_sources (
  story_id uuid references academy.stories on delete cascade, source_id uuid references academy.sources,
  primary key(story_id,source_id)
);
create table academy.dossiers (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  version integer not null check(version > 0), content jsonb not null,
  unique(story_id,version), created_at timestamptz not null default now()
);
create table academy.claims (
  id uuid primary key default gen_random_uuid(), dossier_id uuid not null references academy.dossiers,
  domain_id text not null references academy.domain_packs, text_en text not null,
  type text not null check(type in ('measured_result','author_interpretation','vendor_claim','editorial_explanation','speculation')),
  evidence_level text not null, caveat_en text not null default '',
  status text not null default 'unverified' check(status in ('unverified','verified','narrowed','rejected'))
);
create table academy.evidence (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references academy.sources,
  quote text not null check(length(quote) between 1 and 1500), locator text not null,
  accessed_at timestamptz not null default now()
);
create table academy.claim_evidence (
  claim_id uuid references academy.claims, evidence_id uuid references academy.evidence,
  primary key(claim_id,evidence_id)
);
create table academy.articles (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  version integer not null check(version > 0), slug text not null, title_es text not null,
  content jsonb not null, ai_disclosure_es text not null check(length(ai_disclosure_es)>0),
  published_at timestamptz, unique(story_id,version)
);
create table academy.scripts (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  version integer not null check(version > 0), scenes jsonb not null,
  unique(story_id,version)
);
create table academy.content_assets (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  kind text not null check(kind in ('image','audio','video')), object_path text not null,
  source_url text, license text, attribution text not null default '',
  rights_cleared boolean not null default false, generated boolean not null default false
);
create table academy.editorial_decisions (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  actor_type text not null check(actor_type in ('human','agent')), actor_id text not null,
  decision text not null check(decision in ('select','reject','revise','approve','hold')),
  reason text not null, policy_version text not null,
  article_id uuid references academy.articles, script_id uuid references academy.scripts,
  created_at timestamptz not null default now()
);
create table academy.publications (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  article_id uuid not null references academy.articles, script_id uuid references academy.scripts,
  channel text not null, remote_id text, idempotency_key text not null unique,
  status text not null default 'pending' check(status in ('pending','published','failed','correction_required')),
  published_at timestamptz
);
create table academy.corrections (
  id uuid primary key default gen_random_uuid(), story_id uuid not null references academy.stories,
  previous_article_id uuid not null references academy.articles, new_article_id uuid not null references academy.articles,
  reason_es text not null, changes jsonb not null, published_at timestamptz
);
create table academy.concepts (
  qid text primary key check(qid ~ '^Q[0-9]+$'), term_en text not null, term_es text not null,
  wikipedia_en text, wikipedia_es text, explanation_es text
);
create table academy.story_concepts (
  story_id uuid references academy.stories, qid text references academy.concepts, primary key(story_id,qid)
);
create table academy.concept_edges (
  from_qid text references academy.concepts, to_qid text references academy.concepts,
  relation text not null default 'requires' check(relation='requires'),
  primary key(from_qid,to_qid), check(from_qid<>to_qid)
);
create table academy.story_edges (
  from_story_id uuid references academy.stories, to_story_id uuid references academy.stories,
  relation text not null check(relation in ('follows_up','confirms','disputes')),
  primary key(from_story_id,to_story_id,relation), check(from_story_id<>to_story_id)
);
create table academy.production_jobs (
  id uuid primary key default gen_random_uuid(), story_id uuid references academy.stories,
  stage text not null, idempotency_key text not null unique, payload jsonb not null default '{}',
  status text not null default 'queued' check(status in ('queued','running','succeeded','failed','held')),
  attempts integer not null default 0, max_attempts integer not null default 3,
  available_at timestamptz not null default now(), lease_token uuid, lease_expires_at timestamptz,
  last_error text, result jsonb, created_at timestamptz not null default now()
);
create index production_jobs_ready on academy.production_jobs(status,available_at);
create table academy.agent_runs (
  id uuid primary key default gen_random_uuid(), job_id uuid references academy.production_jobs,
  role text not null, provider text not null, model text not null,
  prompt_version text not null, policy_version text not null, input_hash text not null,
  input_tokens integer not null default 0, output_tokens integer not null default 0,
  cost_usd numeric(12,6), duration_ms integer, output jsonb,
  created_at timestamptz not null default now()
);

-- All editorial tables: service_role writes; approved team members can read.
do $$ declare table_name text; begin
  foreach table_name in array array['editor_members','domain_packs','sources','stories','story_domains','story_sources','dossiers','claims','evidence','claim_evidence','articles','scripts','content_assets','editorial_decisions','publications','corrections','concepts','story_concepts','concept_edges','story_edges','production_jobs','agent_runs'] loop
    execute format('alter table academy.%I enable row level security', table_name);
    execute format('revoke all on table academy.%I from anon, authenticated', table_name);
    execute format('grant select on table academy.%I to authenticated', table_name);
    execute format('grant all on table academy.%I to service_role', table_name);
    execute format('create policy editor_read on academy.%I for select to authenticated using ((select academy.is_editor()))', table_name);
  end loop;
end $$;
-- Public projections only; claims, sources and traces stay private in this starter.
grant select on academy.articles, academy.corrections to anon;
create policy published_articles on academy.articles for select to anon,authenticated
  using(published_at is not null and published_at <= now());
create policy published_corrections on academy.corrections for select to anon,authenticated
  using(published_at is not null and published_at <= now());

-- Atomic claim with SKIP LOCKED and lease token; stale worker cannot acknowledge a new lease.
create function academy.claim_job() returns setof academy.production_jobs
language plpgsql security definer set search_path = '' as $$
declare picked uuid; begin
  update academy.production_jobs set status='failed', last_error='Attempts exhausted', lease_token=null, lease_expires_at=null
    where attempts >= max_attempts and (status='queued' or (status='running' and lease_expires_at < now()));
  select id into picked from academy.production_jobs
    where ((status='queued' and available_at <= now()) or (status='running' and lease_expires_at < now()))
      and attempts < max_attempts
    order by available_at,created_at for update skip locked limit 1;
  if picked is not null then
    return query update academy.production_jobs set status='running', attempts=attempts+1,
      lease_token=gen_random_uuid(),lease_expires_at=now()+interval '10 minutes'
      where id=picked returning *;
  end if;
end $$;
create function academy.finish_job(p_id uuid,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update academy.production_jobs set status='succeeded',result=p_result,lease_token=null,lease_expires_at=null
    where id=p_id and lease_token=p_lease and status='running' and lease_expires_at>now();
  return found;
end $$;
create function academy.fail_job(p_id uuid,p_lease uuid,p_error text,p_hold boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update academy.production_jobs set
    status=case when p_hold then 'held' when attempts>=max_attempts then 'failed' else 'queued' end,
    available_at=now()+make_interval(secs => least(300, power(2,attempts)::integer)),
    last_error=left(p_error,500),lease_token=null,lease_expires_at=null
    where id=p_id and lease_token=p_lease and status='running' and lease_expires_at>now();
  return found;
end $$;
revoke all on function academy.claim_job(), academy.finish_job(uuid,uuid,jsonb), academy.fail_job(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function academy.claim_job(), academy.finish_job(uuid,uuid,jsonb), academy.fail_job(uuid,uuid,text,boolean) to service_role;

insert into storage.buckets(id,name,public) values ('dobrov-academy-assets','dobrov-academy-assets',false);
-- No browser storage policy: worker uses server credentials; future preview uses signed URLs.
