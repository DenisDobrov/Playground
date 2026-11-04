-- Additive acceptance-only claim. Does not replace the normal queue or alter memberships.
-- Deployment requires explicit approval. In particular, do not install SCI-004/013 with it.
create function academy.claim_worker_acceptance_job() returns setof academy.production_jobs
language plpgsql security definer set search_path = '' as $$
declare picked uuid;
begin
  select id into picked from academy.production_jobs
    where idempotency_key='prod002:worker:normalize:v1'
      and stage='normalize_source' and story_id is null
      and payload='{"identifier":"doi:10.9999/academy-prod002-worker-acceptance","synthetic":true,"doNotPublish":true}'::jsonb
      and ((status='queued' and available_at<=now()) or (status='running' and lease_expires_at<now()))
      and attempts<max_attempts
    for update skip locked limit 1;
  if picked is not null then
    return query update academy.production_jobs set status='running', attempts=attempts+1,
      lease_token=gen_random_uuid(),lease_expires_at=now()+interval '10 minutes'
      where id=picked returning *;
  end if;
end $$;
revoke all on function academy.claim_worker_acceptance_job() from public,anon,authenticated;
grant execute on function academy.claim_worker_acceptance_job() to service_role;
