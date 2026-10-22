-- This migration only changes academy objects; legacy app and Supabase Auth settings are untouched.
alter table academy.production_jobs
  add constraint production_jobs_attempts_valid check(attempts >= 0 and max_attempts between 1 and 20),
  add constraint production_jobs_lease_valid check(
    (status='running' and lease_token is not null and lease_expires_at is not null)
    or (status<>'running' and lease_token is null and lease_expires_at is null)
  );

create function academy.renew_job(p_id uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update academy.production_jobs set lease_expires_at=now()+interval '10 minutes'
    where id=p_id and lease_token=p_lease and status='running' and lease_expires_at>now();
  return found;
end $$;
revoke all on function academy.renew_job(uuid,uuid) from public,anon,authenticated;
grant execute on function academy.renew_job(uuid,uuid) to service_role;

create function academy.enqueue_job(p_stage text,p_key text,p_payload jsonb,p_story uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare job_id uuid; begin
  if length(trim(p_stage))=0 or length(trim(p_key))=0 then raise exception 'Stage and idempotency key required'; end if;
  insert into academy.production_jobs(stage,idempotency_key,payload,story_id)
    values(p_stage,p_key,p_payload,p_story) on conflict(idempotency_key) do nothing returning id into job_id;
  if job_id is null then
    select id into job_id from academy.production_jobs where idempotency_key=p_key;
  end if;
  return job_id;
end $$;
revoke all on function academy.enqueue_job(text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function academy.enqueue_job(text,text,jsonb,uuid) to service_role;

-- Minimal domain config belongs to installation, not a destructive/shared-db seed operation.
insert into academy.domain_packs(id,version,config) values
('ai','0.1.0','{"weeklyShare":0.7,"risk":"standard","evidenceLevels":["A0","A1","A2","A3","A-"]}'),
('physics','0.1.0','{"weeklyShare":0.3,"risk":"standard","evidenceLevels":["P0","P1","P2","P3","P-"]}')
on conflict(id) do nothing;
