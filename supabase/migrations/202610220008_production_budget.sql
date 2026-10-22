-- USD microdollars, not floating point. Only trusted workers may mutate the ledger.
create table academy.budget_periods (
  month date primary key check (extract(day from month) = 1),
  limit_micros bigint not null check (limit_micros between 0 and 1000000000000),
  category_limits jsonb not null,
  story_limit_micros bigint not null check (story_limit_micros >= 0),
  video_limit_micros bigint not null check (video_limit_micros >= 0),
  created_at timestamptz not null default now()
);
create table academy.budget_operations (
  id uuid primary key default gen_random_uuid(), idempotency_key text not null unique,
  month date not null references academy.budget_periods,
  category text not null check (category in ('news_analysis','content','voice','video')),
  story_id uuid references academy.stories, video_key text,
  tool text not null, tool_version text not null, price_version text not null,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  estimate_micros bigint not null check (estimate_micros between 0 and 1000000000000),
  actual_micros bigint check (actual_micros between 0 and 1000000000000),
  state text not null default 'reserved' check (state in ('reserved','started','uncertain','settled','released')),
  execution_token uuid, usage jsonb, external_ref text,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '10 minutes',
  resolved_at timestamptz,
  check (category not in ('voice','video') or (story_id is not null and video_key is not null)),
  check (video_key is null or story_id is not null),
  check ((state = 'settled') = (actual_micros is not null))
);
create index on academy.budget_operations(month, state);
create index on academy.budget_operations(story_id, month);
create index on academy.budget_operations(video_key, month);
create table academy.budget_events (
  id bigint generated always as identity primary key,
  operation_id uuid not null references academy.budget_operations,
  previous_state text, state text not null, actual_micros bigint,
  created_at timestamptz not null default now()
);
alter table academy.budget_periods enable row level security;
alter table academy.budget_operations enable row level security;
alter table academy.budget_events enable row level security;
revoke all on academy.budget_periods,academy.budget_operations,academy.budget_events from public,anon,authenticated;
grant select on academy.budget_periods,academy.budget_operations,academy.budget_events to authenticated;
grant all on academy.budget_periods,academy.budget_operations,academy.budget_events to service_role;
grant usage,select on sequence academy.budget_events_id_seq to service_role;
create policy member_read on academy.budget_periods for select to authenticated using ((select academy.is_editor()));
create policy member_read on academy.budget_operations for select to authenticated using ((select academy.is_editor()));
create policy member_read on academy.budget_events for select to authenticated using ((select academy.is_editor()));

create function academy.budget_audit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into academy.budget_events(operation_id,previous_state,state,actual_micros)
  values(new.id,case when tg_op='UPDATE' then old.state end,new.state,new.actual_micros);
  return new;
end $$;
create trigger budget_history after insert or update on academy.budget_operations for each row execute function academy.budget_audit();

-- The monthly plan is immutable in v1: identical setup is idempotent, changed setup needs review.
create function academy.budget_configure(p_month date,p_limit bigint,p_categories jsonb,p_story bigint,p_video bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare old academy.budget_periods; k text; total numeric := 0;
begin
  if p_month is null or extract(day from p_month)<>1 or p_limit is null or p_limit not between 0 and 1000000000000
    or p_story is null or p_story<0 or p_video is null or p_video<0 or p_story>p_limit or p_video>p_limit
    or jsonb_typeof(p_categories) is distinct from 'object' then raise exception 'BUDGET_INVALID' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(p_categories))<>4 then raise exception 'BUDGET_INVALID' using errcode='22023'; end if;
  foreach k in array array['news_analysis','content','voice','video'] loop
    if jsonb_typeof(p_categories->k) is distinct from 'number' or coalesce(p_categories->>k,'') !~ '^[0-9]{1,13}$' then raise exception 'BUDGET_INVALID' using errcode='22023'; end if;
    total := total + (p_categories->>k)::numeric;
  end loop;
  if total>p_limit then raise exception 'BUDGET_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('academy-budget-month:'||p_month::text,0));
  select * into old from academy.budget_periods where month=p_month for update;
  if found then
    if row(old.limit_micros,old.category_limits,old.story_limit_micros,old.video_limit_micros)
      is distinct from row(p_limit,p_categories,p_story,p_video) then raise exception 'BUDGET_PLAN_ALREADY_SET' using errcode='22023'; end if;
    return;
  end if;
  insert into academy.budget_periods(month,limit_micros,category_limits,story_limit_micros,video_limit_micros)
  values(p_month,p_limit,p_categories,p_story,p_video);
end $$;

create function academy.budget_recover(p_month date) returns jsonb language plpgsql security definer set search_path = '' as $$
declare released integer; uncertain integer;
begin
  perform 1 from academy.budget_periods where month=p_month for update;
  if not found then raise exception 'BUDGET_NOT_CONFIGURED' using errcode='P0001'; end if;
  update academy.budget_operations set state='released',resolved_at=now() where month=p_month and state='reserved' and expires_at<=now();
  get diagnostics released = row_count;
  update academy.budget_operations set state='uncertain' where month=p_month and state='started' and expires_at<=now();
  get diagnostics uncertain = row_count;
  return jsonb_build_object('released',released,'uncertain',uncertain);
end $$;

create function academy.budget_reserve(p_key text,p_month date,p_category text,p_estimate bigint,p_story uuid,
  p_video text,p_tool text,p_tool_version text,p_price_version text,p_input_hash text)
returns academy.budget_operations language plpgsql security definer set search_path = '' as $$
declare r academy.budget_operations; b academy.budget_periods;
  total numeric; category_total numeric; story_total numeric; video_total numeric;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'BUDGET_ISOLATION_UNSUPPORTED' using errcode='22023'; end if;
  if p_key is null or length(p_key) not between 1 and 200 or p_month is null
    or p_category is null or p_category not in ('news_analysis','content','voice','video')
    or p_estimate is null or p_estimate not between 0 and 1000000000000
    or p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$'
    or p_tool is null or p_tool !~ '^[A-Za-z0-9._:/-]{1,120}$'
    or p_tool_version is null or length(p_tool_version) not between 1 and 120
    or p_price_version is null or length(p_price_version) not between 1 and 120
    or (p_video is not null and (p_video !~ '^[A-Za-z0-9._:-]{1,160}$' or p_story is null))
    or (p_category in ('voice','video') and (p_story is null or p_video is null))
  then raise exception 'BUDGET_INVALID' using errcode='22023'; end if;
  -- Key first, then period. All mutations lock the same period before reading totals.
  perform pg_advisory_xact_lock(hashtextextended('academy-budget-key:'||p_key,0));
  select * into r from academy.budget_operations where idempotency_key=p_key;
  if found then
    if row(r.month,r.category,r.estimate_micros,r.story_id,r.video_key,r.tool,r.tool_version,r.price_version,r.input_hash)
      is distinct from row(p_month,p_category,p_estimate,p_story,p_video,p_tool,p_tool_version,p_price_version,p_input_hash)
    then raise exception 'BUDGET_KEY_CONFLICT' using errcode='22023'; end if;
    return r;
  end if;
  select * into b from academy.budget_periods where month=p_month for update;
  if not found then raise exception 'BUDGET_NOT_CONFIGURED' using errcode='P0001'; end if;
  -- A never-dispatched reservation can expire. Dispatched work must keep its money held.
  perform academy.budget_recover(p_month);
  select coalesce(sum(amount),0),coalesce(sum(amount) filter(where category=p_category),0),
    coalesce(sum(amount) filter(where story_id=p_story),0),coalesce(sum(amount) filter(where video_key=p_video),0)
  into total,category_total,story_total,video_total
  from (select *,case when state='settled' then actual_micros else estimate_micros end amount
    from academy.budget_operations where month=p_month and state<>'released') ledger;
  if total+p_estimate>b.limit_micros or category_total+p_estimate>(b.category_limits->>p_category)::bigint
    or (p_story is not null and story_total+p_estimate>b.story_limit_micros)
    or (p_video is not null and video_total+p_estimate>b.video_limit_micros)
  then raise exception 'BUDGET_LIMIT' using errcode='P0001'; end if;
  insert into academy.budget_operations(idempotency_key,month,category,estimate_micros,story_id,video_key,tool,tool_version,price_version,input_hash)
  values(p_key,p_month,p_category,p_estimate,p_story,p_video,p_tool,p_tool_version,p_price_version,p_input_hash) returning * into r;
  return r;
end $$;

create function academy.budget_start(p_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare r academy.budget_operations; token uuid; b academy.budget_periods;
  total numeric; category_total numeric; story_total numeric; video_total numeric;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'BUDGET_ISOLATION_UNSUPPORTED' using errcode='22023'; end if;
  select * into r from academy.budget_operations where id=p_id;
  select * into b from academy.budget_periods where month=r.month for update;
  select * into r from academy.budget_operations where id=p_id for update;
  if not found or r.state<>'reserved' or r.expires_at<=now() then raise exception 'BUDGET_NOT_DISPATCHABLE' using errcode='P0001'; end if;
  select coalesce(sum(amount),0),coalesce(sum(amount) filter(where category=r.category),0),
    coalesce(sum(amount) filter(where story_id=r.story_id),0),coalesce(sum(amount) filter(where video_key=r.video_key),0)
  into total,category_total,story_total,video_total
  from (select *,case when state='settled' then actual_micros else estimate_micros end amount
    from academy.budget_operations where month=r.month and state<>'released') ledger;
  if total>b.limit_micros or category_total>(b.category_limits->>r.category)::bigint
    or (r.story_id is not null and story_total>b.story_limit_micros)
    or (r.video_key is not null and video_total>b.video_limit_micros)
  then raise exception 'BUDGET_LIMIT' using errcode='P0001'; end if;
  token := gen_random_uuid();
  update academy.budget_operations set state='started',execution_token=token,expires_at=now()+interval '30 minutes' where id=p_id;
  return token;
end $$;

create function academy.budget_release(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare r academy.budget_operations;
begin
  select * into r from academy.budget_operations where id=p_id;
  perform 1 from academy.budget_periods where month=r.month for update;
  select * into r from academy.budget_operations where id=p_id for update;
  if not found then raise exception 'BUDGET_UNKNOWN' using errcode='22023'; end if;
  if r.state='released' then return; end if;
  if r.state<>'reserved' then raise exception 'BUDGET_RECONCILE_REQUIRED' using errcode='P0001'; end if;
  update academy.budget_operations set state='released',resolved_at=now() where id=p_id;
end $$;

create function academy.budget_uncertain(p_id uuid,p_token uuid) returns void language plpgsql security definer set search_path = '' as $$
declare r academy.budget_operations;
begin
  select * into r from academy.budget_operations where id=p_id;
  perform 1 from academy.budget_periods where month=r.month for update;
  select * into r from academy.budget_operations where id=p_id for update;
  if not found or r.execution_token is distinct from p_token or p_token is null then raise exception 'BUDGET_TOKEN_INVALID' using errcode='22023'; end if;
  if r.state='uncertain' then return; end if;
  if r.state<>'started' then raise exception 'BUDGET_STATE_INVALID' using errcode='22023'; end if;
  update academy.budget_operations set state='uncertain' where id=p_id;
end $$;

create function academy.budget_settle(p_id uuid,p_token uuid,p_actual bigint,p_usage jsonb,p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare r academy.budget_operations; pair record;
begin
  if p_actual is null or p_actual not between 0 and 1000000000000 or jsonb_typeof(p_usage) is distinct from 'object'
    or p_reference is null or length(p_reference) not between 1 and 200 then raise exception 'BUDGET_INVALID' using errcode='22023'; end if;
  for pair in select * from jsonb_each(p_usage) loop
    if pair.key not in ('input_tokens','output_tokens','characters','render_ms','audio_ms') or jsonb_typeof(pair.value)<>'number'
      or pair.value::text !~ '^[0-9]{1,13}$' then raise exception 'BUDGET_USAGE_INVALID' using errcode='22023'; end if;
  end loop;
  select * into r from academy.budget_operations where id=p_id;
  perform 1 from academy.budget_periods where month=r.month for update;
  select * into r from academy.budget_operations where id=p_id for update;
  if not found or r.execution_token is distinct from p_token or p_token is null then raise exception 'BUDGET_TOKEN_INVALID' using errcode='22023'; end if;
  if r.state='settled' then
    if row(r.actual_micros,r.usage,r.external_ref) is distinct from row(p_actual,p_usage,p_reference) then raise exception 'BUDGET_RECEIPT_CONFLICT' using errcode='22023'; end if;
    return;
  end if;
  if r.state not in ('started','uncertain') then raise exception 'BUDGET_STATE_INVALID' using errcode='22023'; end if;
  -- Record real bills even above estimate; the excess blocks subsequent reservations.
  update academy.budget_operations set state='settled',actual_micros=p_actual,usage=p_usage,external_ref=p_reference,resolved_at=now() where id=p_id;
end $$;

create view academy.budget_summary with (security_invoker=true) as
select p.month,p.limit_micros,p.category_limits,p.story_limit_micros,p.video_limit_micros,
  coalesce(sum(o.actual_micros) filter(where o.state='settled'),0) as spent_micros,
  coalesce(sum(o.estimate_micros) filter(where o.state in ('reserved','started','uncertain')),0) as reserved_micros,
  count(o.id) filter(where o.state='uncertain' or (o.state='started' and o.expires_at<=now())) as unresolved_count,
  count(o.id) filter(where o.actual_micros>o.estimate_micros) as overrun_count
from academy.budget_periods p left join academy.budget_operations o on o.month=p.month
group by p.month;
revoke all on academy.budget_summary from public,anon,authenticated;
grant select on academy.budget_summary to authenticated,service_role;
create view academy.budget_category_summary with (security_invoker=true) as
select p.month,c.category,(p.category_limits->>c.category)::bigint as limit_micros,
  coalesce(sum(o.actual_micros) filter(where o.state='settled'),0) as spent_micros,
  coalesce(sum(o.estimate_micros) filter(where o.state in ('reserved','started','uncertain')),0) as reserved_micros
from academy.budget_periods p cross join (values ('news_analysis'),('content'),('voice'),('video')) c(category)
left join academy.budget_operations o on o.month=p.month and o.category=c.category
group by p.month,c.category;
revoke all on academy.budget_category_summary from public,anon,authenticated;
grant select on academy.budget_category_summary to authenticated,service_role;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='academy' and p.proname like 'budget_%'
  loop execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
    execute 'grant execute on function '||f.signature||' to service_role';
  end loop;
end $$;
notify pgrst,'reload schema';
