-- NEWS-004: metadata only; immutable news/research/publication snapshots are untouched.
alter table academy.news_state
 add column youtube_id text check(youtube_id is null or youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
 add column youtube_language text check(youtube_language is null or youtube_language in ('es','en','ru','zh-Hans')),
 add column youtube_configured boolean not null default false,
 add column media_version integer not null default 0 check(media_version>=0),
 add constraint news_youtube_language_requires_id check(youtube_id is not null or youtube_language is null);

create table academy.news_metadata_events (
 id uuid primary key default gen_random_uuid(),story_id uuid not null references academy.stories,
 actor_id uuid not null references auth.users,origin text not null check(origin in ('editor_ui','owner_instruction')),
 kind text not null check(kind in ('youtube_link','video_candidate')),
 request_id uuid not null unique,expected_version integer not null check(expected_version>=0),
 before_value jsonb not null,after_value jsonb not null,
 instruction_hash text references academy.news_batches(source_hash) check(instruction_hash is null or instruction_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 check((origin='owner_instruction')=(instruction_hash is not null))
);
create trigger news_metadata_events_immutable before update or delete on academy.news_metadata_events for each row execute function academy.guard_news_immutable();
alter table academy.news_metadata_events enable row level security;
revoke all on academy.news_metadata_events from public,anon,authenticated;
grant select on academy.news_metadata_events to authenticated;
grant all on academy.news_metadata_events to service_role;
create policy member_read on academy.news_metadata_events for select to authenticated using(academy.is_editor());

create function academy.news_set_youtube(p_story uuid,p_expected_version integer,p_request uuid,p_youtube_id text,p_language text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();s academy.news_state;e academy.news_metadata_events;eid uuid;next_value jsonb;begin
 if not exists(select 1 from academy.editor_members where user_id=actor and role='editor') then raise exception 'Editor role required' using errcode='42501';end if;
 if p_story is null or p_request is null or p_expected_version is null or p_expected_version<0
 or (p_youtube_id is not null and p_youtube_id !~ '^[A-Za-z0-9_-]{11}$')
 or (p_language is not null and p_language not in ('es','en','ru','zh-Hans'))
 or (p_youtube_id is null and p_language is not null) then raise exception 'NEWS_MEDIA_INVALID' using errcode='22023';end if;
 select * into s from academy.news_state where story_id=p_story for update;
 if not found then raise exception 'NEWS_STORY_MISSING' using errcode='22023';end if;
 next_value:=jsonb_build_object('youtube_id',p_youtube_id,'youtube_language',p_language,'youtube_configured',true);
 select * into e from academy.news_metadata_events where request_id=p_request;
 if found then
  if e.story_id<>p_story or e.actor_id<>actor or e.origin<>'editor_ui' or e.kind<>'youtube_link' or e.expected_version<>p_expected_version or e.after_value<>next_value then raise exception 'NEWS_REQUEST_CONFLICT' using errcode='22023';end if;
  return e.id;
 end if;
 if s.media_version<>p_expected_version then raise exception 'NEWS_MEDIA_STALE' using errcode='40001';end if;
 insert into academy.news_metadata_events(story_id,actor_id,origin,kind,request_id,expected_version,before_value,after_value)
 values(p_story,actor,'editor_ui','youtube_link',p_request,p_expected_version,jsonb_build_object('youtube_id',s.youtube_id,'youtube_language',s.youtube_language,'youtube_configured',s.youtube_configured),next_value) returning id into eid;
 update academy.news_state set youtube_id=p_youtube_id,youtube_language=p_language,youtube_configured=true,media_version=media_version+1 where story_id=p_story;
 return eid;
end$$;
revoke all on function academy.news_set_youtube(uuid,integer,uuid,text,text) from public,anon,service_role;
grant execute on function academy.news_set_youtube(uuid,integer,uuid,text,text) to authenticated;

-- Deliberately exposes only related-media data, never draft identity or private state.
create view academy.news_public_media with(security_barrier=true) as
 select s.story_id,s.youtube_id,s.youtube_language,s.youtube_configured
 from academy.news_state s
 where exists(select 1 from academy.news_releases r where r.story_id=s.story_id and r.published_at<=now());
revoke all on academy.news_public_media from public,anon,authenticated;
grant select on academy.news_public_media to anon,authenticated,service_role;
notify pgrst,'reload schema';
