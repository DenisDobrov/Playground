-- NEWS-001: additive, independent of uninstalled SCI-004 migration 013 and worker 014.
create table academy.news_batches (
 id uuid primary key default gen_random_uuid(), source_text text not null,
 source_hash text generated always as (encode(extensions.digest(source_text,'sha256'),'hex')) stored unique,
 period_start date not null, period_end date not null, created_at timestamptz not null default now(),
 owner_authorization jsonb, check(period_end>=period_start)
);
create table academy.news_packages (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references academy.news_batches,
 story_id uuid not null references academy.stories, version int not null check(version>0),
 event_key text not null, slug text not null, section int not null check(section between 1 and 17),
 content jsonb not null, package_hash text generated always as (encode(extensions.digest(content::text,'sha256'),'hex')) stored,
 created_at timestamptz not null default now(), unique(story_id,version),unique(batch_id,section,package_hash),
 check((content->>'policy'='news-release/1') is true),check((content#>>'{verification,independentScientificVerification}'='not_performed') is true),
 check(jsonb_typeof(content->'sources')='array' and jsonb_array_length(content->'sources')>0),
 check((jsonb_typeof(content->'en')='object' and jsonb_typeof(content->'es')='object') is true)
);
create table academy.news_state (
 story_id uuid primary key references academy.stories, package_id uuid not null references academy.news_packages,
 version int not null default 0, decision text check(decision in ('approve','reject')),
 comment text not null default '', suggested_video boolean not null default false, suggested_science boolean not null default false,
 flags_origin text not null default 'ai_suggested' check(flags_origin in ('ai_suggested','owner_set')), updated_at timestamptz not null default now()
);
create table academy.news_decisions (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references academy.news_packages,
 actor_id uuid not null references auth.users, decision text not null check(decision in ('approve','reject')),
 comment text not null, suggested_video boolean not null, suggested_science boolean not null,
 request_id uuid not null unique, expected_version int not null, package_hash text not null,
 policy text not null default 'news-release/1', origin text not null check(origin in ('editor_ui','owner_batch_instruction')),
 created_at timestamptz not null default now()
);
create table academy.news_releases (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references academy.news_packages,
 decision_id uuid not null references academy.news_decisions, story_id uuid not null references academy.stories,
 language text not null check(language in ('en','es')), slug text not null, content jsonb not null,
 published_at timestamptz not null default now(), unique(package_id,language)
);
create table academy.news_outbox (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references academy.news_packages,
 decision_id uuid not null references academy.news_decisions, channel text not null,
 language text not null check(language in ('en','es','bilingual')), payload jsonb not null,
 state text not null default 'blocked' check(state in ('pending','sending','published','blocked','failed','uncertain','cancelled')),
 remote_id text,remote_url text,error_code text,lease_token uuid,lease_expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(package_id,channel,language),check(channel in ('telegram','x','bluesky','linkedin','facebook','instagram','threads','youtube_posts','whatsapp_channel'))
);
create function academy.guard_news_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'NEWS_IMMUTABLE_REVISION';end$$;
create trigger news_batches_immutable before update or delete on academy.news_batches for each row execute function academy.guard_news_immutable();
create trigger news_packages_immutable before update or delete on academy.news_packages for each row execute function academy.guard_news_immutable();
create trigger news_decisions_immutable before update or delete on academy.news_decisions for each row execute function academy.guard_news_immutable();
create trigger news_releases_immutable before update or delete on academy.news_releases for each row execute function academy.guard_news_immutable();
do $$declare t text;begin
 foreach t in array array['news_batches','news_packages','news_state','news_decisions','news_releases','news_outbox'] loop
 execute format('alter table academy.%I enable row level security',t);
 execute format('revoke all on academy.%I from public,anon,authenticated',t);
 execute format('grant select on academy.%I to authenticated',t);
 execute format('grant all on academy.%I to service_role',t);
 execute format('create policy member_read on academy.%I for select to authenticated using (academy.is_editor())',t);
 end loop;
end$$;
grant select on academy.news_releases to anon;
create policy published_read on academy.news_releases for select to anon using(published_at<=now());

-- Trusted operator imports exact, schema-validated preparation; browser cannot submit extraction/content.
create function academy.news_import(p_batch uuid,p_story uuid,p_content jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid; pid uuid; previous academy.news_state; hash text; begin
 if not exists(select 1 from academy.news_batches where id=p_batch) or p_content->>'policy' is distinct from 'news-release/1' or p_content#>>'{provenance,sourceHash}' is distinct from (select source_hash from academy.news_batches where id=p_batch) then raise exception 'NEWS_SOURCE_MISMATCH';end if;
 if p_content->>'slug' is null or p_content->>'slug' !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'NEWS_SLUG_INVALID';end if;
 hash:=encode(extensions.digest(p_content::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_content->>'eventKey',0));
 select id into pid from academy.news_packages where batch_id=p_batch and section=(p_content->>'section')::int and package_hash=hash;
 if found then return pid;end if;
 select story_id into sid from academy.news_packages where event_key=p_content->>'eventKey' order by created_at desc limit 1;
 sid:=coalesce(sid,p_story);
 if sid is null then insert into academy.stories(slug,title_en) values(p_content->>'slug',p_content#>>'{en,title}') returning id into sid;end if;
 select * into previous from academy.news_state where story_id=sid for update;
 insert into academy.news_packages(batch_id,story_id,version,event_key,slug,section,content)
 values(p_batch,sid,coalesce((select max(version) from academy.news_packages where story_id=sid),0)+1,p_content->>'eventKey',p_content->>'slug',(p_content->>'section')::int,p_content) returning id into pid;
 -- New content invalidates approval; existing owner flag choices persist across import.
 insert into academy.news_state(story_id,package_id,suggested_video,suggested_science)
 values(sid,pid,(p_content#>>'{suggestions,video}')::boolean,(p_content#>>'{suggestions,sciencePublication}')::boolean)
 on conflict(story_id) do update set package_id=excluded.package_id,decision=null,version=academy.news_state.version+1,updated_at=now();
 update academy.news_outbox set state='cancelled',updated_at=now() where package_id=previous.package_id and state in ('pending','blocked','failed');
 return pid;
end$$;
revoke all on function academy.news_import(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function academy.news_import(uuid,uuid,jsonb) to service_role;

create function academy.news_apply_decision(p_actor uuid,p_origin text,p_package uuid,p_expected_version int,p_request uuid,p_decision text,p_comment text,p_video boolean,p_science boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare pkg academy.news_packages;s academy.news_state;d academy.news_decisions;did uuid;lang text;v_channel text;begin
 if not exists(select 1 from academy.editor_members where user_id=p_actor and role='editor') then raise exception 'Editor role required' using errcode='42501';end if;
 if p_request is null or p_expected_version is null or p_decision is null or p_decision not in ('approve','reject') or p_comment is null or length(p_comment)>4000 or p_video is null or p_science is null then raise exception 'NEWS_INVALID_INPUT' using errcode='22023';end if;
 select * into pkg from academy.news_packages where id=p_package;
 if not found then raise exception 'NEWS_PACKAGE_MISSING';end if;
 select * into s from academy.news_state where story_id=pkg.story_id for update;
 select * into d from academy.news_decisions where request_id=p_request;
 if found then
 if d.package_id<>p_package or d.actor_id<>p_actor or d.origin<>p_origin or d.decision<>p_decision or d.comment<>p_comment or d.suggested_video<>p_video or d.suggested_science<>p_science or d.expected_version<>p_expected_version then raise exception 'NEWS_REQUEST_CONFLICT' using errcode='22023';end if;
 return d.id;end if;
 if s.package_id<>p_package or s.version<>p_expected_version then raise exception 'NEWS_STALE_PACKAGE' using errcode='40001';end if;
 if p_decision='approve' and pkg.content#>>'{verification,status}' is distinct from 'checked_summary' then raise exception 'NEWS_SOURCE_CHECK_REQUIRED';end if;
 insert into academy.news_decisions(package_id,actor_id,decision,comment,suggested_video,suggested_science,request_id,expected_version,package_hash,origin)
 values(p_package,p_actor,p_decision,p_comment,p_video,p_science,p_request,p_expected_version,pkg.package_hash,p_origin) returning id into did;
 update academy.news_state set decision=p_decision,comment=p_comment,suggested_video=p_video,suggested_science=p_science,flags_origin=case when p_origin='editor_ui' then 'owner_set' else flags_origin end,version=version+1,updated_at=now() where story_id=pkg.story_id;
 if p_decision='reject' then
 update academy.news_outbox set state='cancelled',updated_at=now() where package_id=p_package and state in ('pending','blocked','failed');
 -- Published and ambiguous/in-flight work remains visible for reconciliation, never pretended deleted.
 else
 foreach lang in array array['en','es'] loop
 insert into academy.news_releases(package_id,decision_id,story_id,language,slug,content)
 values(p_package,did,pkg.story_id,lang,pkg.slug,jsonb_build_object('article',pkg.content->lang,'sources',pkg.content->'sources','period',pkg.content->'period','section',pkg.section,'verification',pkg.content->'verification')) on conflict(package_id,language) do nothing;
 end loop;
 for v_channel in select jsonb_object_keys(pkg.content->'channelTexts') loop
 insert into academy.news_outbox(package_id,decision_id,channel,language,payload,error_code)
 values(p_package,did,v_channel,'bilingual',pkg.content->'channelTexts'->v_channel,'CHANNEL_ACCESS_UNVERIFIED') on conflict(package_id,channel,language) do nothing;
 end loop;
 end if;return did;
end$$;
revoke all on function academy.news_apply_decision(uuid,text,uuid,int,uuid,text,text,boolean,boolean) from public,anon,authenticated,service_role;
create function academy.news_decide(p_package uuid,p_expected_version int,p_request uuid,p_decision text,p_comment text,p_video boolean,p_science boolean) returns uuid
language sql security definer set search_path='' as $$select academy.news_apply_decision(auth.uid(),'editor_ui',p_package,p_expected_version,p_request,p_decision,p_comment,p_video,p_science)$$;
revoke all on function academy.news_decide(uuid,int,uuid,text,text,boolean,boolean) from public,anon;
grant execute on function academy.news_decide(uuid,int,uuid,text,text,boolean,boolean) to authenticated;
create function academy.news_batch_approve(p_batch uuid,p_authorization_hash text,p_package uuid,p_expected_version int,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$declare b academy.news_batches;s academy.news_state;begin
 select * into b from academy.news_batches where id=p_batch;
 if b.owner_authorization->>'instructionHash' is distinct from p_authorization_hash or b.owner_authorization->>'policy' is distinct from 'news-release/1' or not exists(select 1 from academy.news_packages where id=p_package and batch_id=p_batch) then raise exception 'NEWS_BATCH_AUTHORIZATION_REQUIRED';end if;
 select * into s from academy.news_state where package_id=p_package;
 return academy.news_apply_decision((b.owner_authorization->>'ownerId')::uuid,'owner_batch_instruction',p_package,p_expected_version,p_request,'approve','',s.suggested_video,s.suggested_science);
end$$;
revoke all on function academy.news_batch_approve(uuid,text,uuid,int,uuid) from public,anon,authenticated;
grant execute on function academy.news_batch_approve(uuid,text,uuid,int,uuid) to service_role;
notify pgrst,'reload schema';

-- No shared research queue is enabled. Each send is explicitly scoped to one news outbox item.
create table academy.news_delivery_events (
 id uuid primary key default gen_random_uuid(), outbox_id uuid not null references academy.news_outbox,
 event text not null, evidence jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table academy.news_delivery_events enable row level security;
revoke all on academy.news_delivery_events from public,anon,authenticated,service_role;
grant select on academy.news_delivery_events to authenticated,service_role;
create policy member_read on academy.news_delivery_events for select to authenticated using(academy.is_editor());
create trigger news_delivery_events_immutable before update or delete on academy.news_delivery_events for each row execute function academy.guard_news_immutable();

create function academy.news_claim_delivery(p_id uuid) returns academy.news_outbox
language plpgsql security definer set search_path='' as $$declare job academy.news_outbox;s academy.news_state;begin
 select * into job from academy.news_outbox where id=p_id for update;
 if not found then return null;end if;
 -- An expired sender may have posted successfully. Never reclaim it for another send.
 if job.state='sending' and job.lease_expires_at<=now() then
 update academy.news_outbox set state='uncertain',error_code='DELIVERY_LEASE_EXPIRED',updated_at=now() where id=p_id;
 insert into academy.news_delivery_events(outbox_id,event) values(p_id,'uncertain');return null;
 end if;
 if job.state<>'pending' then return null;end if;
 select s0.* into s from academy.news_state s0 where package_id=job.package_id for update;
 if not found or s.decision is distinct from 'approve' or (select count(*) from academy.news_releases where package_id=job.package_id)<>2 then
 update academy.news_outbox set state='cancelled',updated_at=now() where id=p_id;return null;
 end if;
 update academy.news_outbox set state='sending',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now() where id=p_id returning * into job;
 insert into academy.news_delivery_events(outbox_id,event,evidence) values(p_id,'claimed',jsonb_build_object('lease',job.lease_token));
 return job;
end$$;
revoke all on function academy.news_claim_delivery(uuid) from public,anon,authenticated;
grant execute on function academy.news_claim_delivery(uuid) to service_role;

create function academy.news_finish_delivery(p_id uuid,p_lease uuid,p_state text,p_remote_id text,p_url text,p_error text,p_evidence jsonb) returns boolean
language plpgsql security definer set search_path='' as $$declare job academy.news_outbox;begin
 if p_state is null or p_state not in ('published','failed','uncertain','blocked') or p_evidence is null then raise exception 'NEWS_DELIVERY_INVALID';end if;
 select * into job from academy.news_outbox where id=p_id for update;
 if not found or job.state<>'sending' or job.lease_token is distinct from p_lease then return false;end if;
 if p_state='published' and (coalesce(length(p_remote_id),0)=0 or p_url is null or p_url !~ '^https://[^/@[:space:]]+/' or p_evidence->>'verifiedAt' is null) then raise exception 'NEWS_DELIVERY_PROOF_REQUIRED';end if;
 update academy.news_outbox set state=p_state,remote_id=p_remote_id,remote_url=p_url,error_code=p_error,lease_expires_at=null,updated_at=now() where id=p_id;
 insert into academy.news_delivery_events(outbox_id,event,evidence) values(p_id,p_state,p_evidence);
 return true;
end$$;
revoke all on function academy.news_finish_delivery(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function academy.news_finish_delivery(uuid,uuid,text,text,text,text,jsonb) to service_role;

-- Operator reconciliation can attach one verified weekly digest to each covered exact package.
-- It never sends, deletes, or assumes that a timeout means failure.
create function academy.news_reconcile_delivery(p_id uuid,p_remote_id text,p_url text,p_evidence jsonb) returns boolean
language plpgsql security definer set search_path='' as $$declare job academy.news_outbox;begin
 select * into job from academy.news_outbox where id=p_id for update;
 if not found then return false;end if;
 if coalesce(length(p_remote_id),0)=0 or p_url is null or p_url !~ '^https://[^/@[:space:]]+/' or p_evidence->>'verifiedAt' is null or p_evidence->>'account' is null then raise exception 'NEWS_DELIVERY_PROOF_REQUIRED';end if;
 if job.state='published' then
 if job.remote_id is distinct from p_remote_id or job.remote_url is distinct from p_url then raise exception 'NEWS_DELIVERY_CONFLICT';end if;return true;end if;
 if not exists(select 1 from academy.news_releases where package_id=job.package_id) then raise exception 'NEWS_SITE_RELEASE_REQUIRED';end if;
 update academy.news_outbox set state='published',remote_id=p_remote_id,remote_url=p_url,error_code=null,lease_expires_at=null,updated_at=now() where id=p_id;
 insert into academy.news_delivery_events(outbox_id,event,evidence) values(p_id,'reconciled',p_evidence);
 return true;
end$$;
revoke all on function academy.news_reconcile_delivery(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function academy.news_reconcile_delivery(uuid,text,text,jsonb) to service_role;
