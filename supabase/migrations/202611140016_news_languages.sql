-- NEWS-003: compatible four-language snapshots. No historical revisions or roles change.
alter table academy.news_releases drop constraint news_releases_language_check;
alter table academy.news_releases add constraint news_releases_language_check check(language in ('en','es','ru','zh-Hans'));

-- Internal release gate: new preparation checks never constitute human approval.
create function academy.news_validate_languages(content jsonb) returns void
language plpgsql set search_path='' as $$declare lang text;heading text;begin
 if content->>'period' is null or content->>'period' !~ '^(standalone:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]{4}-[0-9]{2}-[0-9]{2})$' then raise exception 'NEWS_PERIOD_REQUIRED';end if;
 if (content ? 'ru' or content ? 'zh-Hans') and content#>>'{research,version}' is distinct from 'news-003/1' then raise exception 'NEWS_LANGUAGE_CHECK_REQUIRED';end if;
 if content->>'period'<>'2026-11-01/2026-11-07' and content->>'period' not like 'standalone:%' and not content ? 'research' then raise exception 'NEWS_RESEARCH_TEMPLATE_REQUIRED';end if;
 if not content ? 'research' then return;end if;
 if content#>>'{research,version}' is distinct from 'news-003/1' or coalesce(content#>>'{research,sourceReview,status}','') not in ('checked','limited') or content#>>'{research,sourceReview,method}' is distinct from 'agent_source_meaning_check' or content#>>'{research,dossier,independent_verification}' is distinct from 'not_performed' or content#>>'{research,humanReview}' is distinct from 'pending_exact_package_decision' then raise exception 'NEWS_SOURCE_CHECK_REQUIRED';end if;
 if jsonb_typeof(content#>'{research,languageChecks}') is distinct from 'array' then raise exception 'NEWS_LANGUAGE_CHECK_REQUIRED';end if;
 foreach lang in array array['en','es','ru','zh-Hans'] loop
  if content ? lang then
   if jsonb_typeof(content->lang) is distinct from 'object' then raise exception 'NEWS_LANGUAGE_INVALID';end if;
   if (select count(*) from jsonb_array_elements(content#>'{research,languageChecks}') c where c->>'language'=lang)<>1 or (select count(*) from jsonb_array_elements(content#>'{research,languageChecks}') c where c->>'language'=lang and c->>'status'='checked' and c->>'method'='agent_consistency_check')<>1 then raise exception 'NEWS_LANGUAGE_CHECK_REQUIRED';end if;
   heading:=case lang when 'es' then 'Por qué importa' when 'en' then 'Why it matters' when 'ru' then 'Почему это важно' else '为什么重要' end;
   if not exists(select 1 from jsonb_array_elements(content->lang->'blocks') b where b->>'type'='heading' and b->>'text'=heading) then raise exception 'NEWS_IMPORTANCE_REQUIRED';end if;
  end if;
 end loop;
end$$;
revoke all on function academy.news_validate_languages(jsonb) from public,anon,authenticated,service_role;

create or replace function academy.news_apply_decision(p_actor uuid,p_origin text,p_package uuid,p_expected_version int,p_request uuid,p_decision text,p_comment text,p_video boolean,p_science boolean) returns uuid
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
 if p_decision='approve' then perform academy.news_validate_languages(pkg.content);end if;
 insert into academy.news_decisions(package_id,actor_id,decision,comment,suggested_video,suggested_science,request_id,expected_version,package_hash,origin)
 values(p_package,p_actor,p_decision,p_comment,p_video,p_science,p_request,p_expected_version,pkg.package_hash,p_origin) returning id into did;
 update academy.news_state set decision=p_decision,comment=p_comment,suggested_video=p_video,suggested_science=p_science,flags_origin=case when p_origin='editor_ui' then 'owner_set' else flags_origin end,version=version+1,updated_at=now() where story_id=pkg.story_id;
 if p_decision='reject' then
 update academy.news_outbox set state='cancelled',updated_at=now() where package_id=p_package and state in ('pending','blocked','failed');
 -- Published and ambiguous/in-flight work remains visible for reconciliation, never pretended deleted.
 else
 for lang in select l from unnest(array['en','es','ru','zh-Hans']) l where jsonb_typeof(pkg.content->l)='object' loop
 insert into academy.news_releases(package_id,decision_id,story_id,language,slug,content)
 values(p_package,did,pkg.story_id,lang,pkg.slug,jsonb_build_object('article',pkg.content->lang,'sources',pkg.content->'sources','period',pkg.content->'period','section',pkg.section,'verification',pkg.content->'verification','eventDates',pkg.content#>'{research,eventDates}')) on conflict(package_id,language) do nothing;
 end loop;
 for v_channel in select jsonb_object_keys(pkg.content->'channelTexts') loop
 insert into academy.news_outbox(package_id,decision_id,channel,language,payload,error_code)
 values(p_package,did,v_channel,'bilingual',pkg.content->'channelTexts'->v_channel,'CHANNEL_ACCESS_UNVERIFIED') on conflict(package_id,channel,language) do nothing;
 end loop;
 end if;return did;
end$$;

create or replace function academy.news_claim_delivery(p_id uuid) returns academy.news_outbox
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
 if not found or s.decision is distinct from 'approve' or exists(select 1 from academy.news_packages p cross join unnest(array['en','es','ru','zh-Hans']) l where p.id=job.package_id and jsonb_typeof(p.content->l)='object' and not exists(select 1 from academy.news_releases r where r.package_id=p.id and r.language=l)) then
 update academy.news_outbox set state='cancelled',updated_at=now() where id=p_id;return null;
 end if;
 update academy.news_outbox set state='sending',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now() where id=p_id returning * into job;
 insert into academy.news_delivery_events(outbox_id,event,evidence) values(p_id,'claimed',jsonb_build_object('lease',job.lease_token));
 return job;
end$$;

-- CREATE OR REPLACE preserves the existing scoped ACLs. Only existing authenticated
-- news_decide and authorized legacy batch calls can invoke the internal decision function.
notify pgrst,'reload schema';
