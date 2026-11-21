-- KB-001. Private projections of existing records; no backfill, publication or model calls.
-- Requires 001–012 and 015–017, not the separately gated content migration 013.
create view academy.knowledge_records with (security_invoker = true) as
with news as (
 select p.*, s.package_id=p.id as is_current, s.decision as current_decision
 from academy.news_packages p join academy.news_state s on s.story_id=p.story_id
), tags as (
 select distinct n.id,n.created_at,lower(trim(t.value)) as tag
 from news n cross join lateral jsonb_array_elements_text(
   coalesce(n.content#>'{en,tags}','[]') || coalesce(n.content#>'{es,tags}','[]') ||
   coalesce(n.content#>'{ru,tags}','[]') || coalesce(n.content#>'{zh-Hans,tags}','[]')) t
 where n.is_current and length(trim(t.value)) between 1 and 100
), records as (
 select 'news:'||n.id as entry_key,'material'::text as kind,n.content#>>'{en,title}' as title,
 coalesce(n.content#>>'{research,dossier,summaryEn}',n.content#>>'{en,paragraphs,0}','') as summary,
 n.story_id,n.id as package_id,n.created_at,n.is_current,
 jsonb_build_object('origin','news_package','status',case when not n.is_current then 'historical' else coalesce(n.current_decision,'pending') end,
   'revision',n.version::text,'independentVerification',n.content#>>'{verification,independentScientificVerification}',
   'limitations',n.content#>>'{en,limitations}',
   'fields',jsonb_build_object('ES',n.content#>>'{es,title}','RU',n.content#>>'{ru,title}','中文',n.content#>>'{zh-Hans,title}',
     'Проверка источников',n.content#>>'{verification,status}','Результат проверки',n.content#>>'{verification,reason}'),
   'sources',n.content->'sources','keywords',concat_ws(' ',n.slug,n.content#>>'{en,tags}',n.content#>>'{es,tags}',n.content#>>'{ru,tags}'),
   'related',coalesce((select jsonb_agg('news-source:'||n.id||':'||s.ord order by s.ord) from jsonb_array_elements(n.content->'sources') with ordinality s(value,ord)),'[]'),
   'publications',coalesce((select jsonb_agg(jsonb_build_object('language',r.language,'slug',r.slug,'publishedAt',r.published_at) order by r.language)
     from academy.news_releases r where r.package_id=n.id),'[]')) as payload
 from news n
 union all
 select 'news-source:'||n.id||':'||s.ord,'source',s.value->>'title',s.value->>'finding',n.story_id,n.id,n.created_at,n.is_current,
 jsonb_build_object('origin','news_source_observation','status',s.value->>'access','revision',n.version::text,
   'independentVerification','not_performed','fields',jsonb_build_object('Тип источника',s.value->>'kind',
   'Дата исследования',s.value->>'studyDate','Дата анонса',s.value->>'announcementDate','Проверено агентом',s.value->>'checkedAt'),
   'sources',jsonb_build_array(s.value),'related',jsonb_build_array('news:'||n.id))
 from news n cross join lateral jsonb_array_elements(n.content->'sources') with ordinality s(value,ord)
 union all
 select 'news-claim:'||n.id||':'||c.ord,'claim',c.value->>'textEn',coalesce(c.value->>'limitations',''),n.story_id,n.id,n.created_at,n.is_current,
 jsonb_build_object('origin','agent_news_dossier','status',coalesce(n.content#>>'{research,sourceReview,status}','unverified'),
   'revision',n.version::text,'independentVerification','not_performed','limitations',c.value->>'limitations',
   'fields',jsonb_build_object('Claim ID',c.value->>'id','Тип',c.value->>'type','Количество',c.value->>'quantity','Единица',c.value->>'unit',
     'Объект',c.value->>'object','Условия',c.value->>'conditions','Сравнение',c.value->>'comparator','Выборка',c.value->>'sample','Неопределённость',c.value->>'uncertainty'),
   'sources',jsonb_build_array(jsonb_build_object('url',c.value->>'source','title','Источник утверждения','locator',c.value->>'locator')),
   'related',jsonb_build_array('news:'||n.id))
 from news n cross join lateral jsonb_array_elements(coalesce(n.content#>'{research,dossier,claims}','[]')) with ordinality c(value,ord)
 union all
 select 'source:'||s.id,'source',s.title_en,s.canonical_id,null::uuid,null::uuid,s.created_at,true,
 jsonb_build_object('origin','canonical_source','status','metadata','fields',jsonb_build_object('Canonical ID',s.canonical_id,'Тип',s.kind,'Лицензия',s.license),
   'keywords',coalesce((select string_agg(a.alias,' ' order by a.alias) from academy.source_aliases a where a.source_id=s.id),''),
   'sources',jsonb_build_array(jsonb_build_object('title',s.title_en,'url',s.url)),
   'related',coalesce((select jsonb_agg('news:'||ns.package_id order by ns.package_id) from academy.story_sources l join academy.news_state ns on ns.story_id=l.story_id where l.source_id=s.id),'[]'))
 from academy.sources s
 union all
 select 'concept:'||c.qid,'topic',c.term_en,coalesce(c.explanation_es,''),null,null,null,true,
 jsonb_build_object('origin','concept','status','catalogued','fields',jsonb_build_object('EN',c.term_en,'ES',c.term_es,'Wikidata',c.qid),
   'sources',jsonb_build_array(jsonb_build_object('title','Wikipedia EN','url',c.wikipedia_en),jsonb_build_object('title','Wikipedia ES','url',c.wikipedia_es)),
   'related',coalesce((select jsonb_agg('news:'||n.package_id order by n.package_id) from academy.story_concepts sc join academy.news_state n on n.story_id=sc.story_id where sc.qid=c.qid),'[]'))
 from academy.concepts c
 union all
 select 'tag:'||encode(extensions.digest(t.tag,'sha256'),'hex'),'topic',t.tag,'Тема из тегов существующих материалов. Совпадение тега не означает подтверждение научных выводов.',null,null,max(t.created_at),true,
 jsonb_build_object('origin','article_tag','status','catalogued','fields',jsonb_build_object('Материалов',count(*)::text),
   'related',jsonb_agg('news:'||t.id order by t.created_at desc,t.id))
 from tags t group by t.tag
 union all
 select 'dossier:'||d.id,'material',s.title_en,coalesce(d.content->>'summaryEn',d.content#>>'{planning,angle}','Research dossier'),d.story_id,null,d.created_at,
 not exists(select 1 from academy.dossiers newer where newer.story_id=d.story_id and newer.version>d.version),
 jsonb_build_object('origin','research_dossier','status','research','revision',d.version::text,
   'fields',jsonb_build_object('Авторский тип',d.author_type,'Input hash',d.input_hash),
   'related',coalesce((select jsonb_agg('claim:'||c.id order by c.id) from academy.claims c where c.dossier_id=d.id),'[]'))
 from academy.dossiers d join academy.stories s on s.id=d.story_id
 union all
 select 'claim:'||c.id,'claim',c.text_en,c.caveat_en,d.story_id,null,d.created_at,
 not exists(select 1 from academy.dossiers newer where newer.story_id=d.story_id and newer.version>d.version),
 jsonb_build_object('origin','research_claim','status',c.status,'revision',d.version::text,'limitations',c.caveat_en,
   'independentVerification',coalesce(review.independent_verification,'not_recorded'),
   'fields',jsonb_build_object('Тип',c.type,'Уровень evidence',c.evidence_level,'Извлечение',c.extraction_status,
     'Последнее решение по смыслу',review.decision,'Ограниченная формулировка',review.narrowed_text,'Мотив проверки',review.reason,
     'Reviewer ID',review.reviewer_id::text,'Дата проверки',review.created_at::text),
   'reviewId',review.id,'related',jsonb_build_array('dossier:'||d.id),
   'sources',coalesce((select jsonb_agg(jsonb_build_object('title',s.title_en,'url',s.url,'quote',e.quote,'locator',e.locator,'limitations',e.limitations) order by e.id)
     from academy.claim_evidence l join academy.evidence e on e.id=l.evidence_id join academy.sources s on s.id=e.source_id where l.claim_id=c.id),'[]'))
 from academy.claims c join academy.dossiers d on d.id=c.dossier_id
 left join lateral (select r.* from academy.scientific_reviews r where r.claim_id=c.id order by r.version desc limit 1) review on true
 union all
 select 'decision:'||d.id,'decision',s.title_en,d.reason,d.story_id,null,d.created_at,true,
 jsonb_build_object('origin','editorial_decision','status',d.decision,'fields',jsonb_build_object('Автор',d.actor_id,'Политика',d.policy_version),
   'ownerComment',d.reason,'related',coalesce((select jsonb_agg('news:'||n.package_id) from academy.news_state n where n.story_id=d.story_id),'[]'))
 from academy.editorial_decisions d join academy.stories s on s.id=d.story_id where d.actor_type='human'
 union all
 select 'news-decision:'||d.id,'decision',n.content#>>'{en,title}',d.comment,n.story_id,n.id,d.created_at,true,
 jsonb_build_object('origin','news_decision','status',d.decision,'revision',n.version::text,'ownerComment',d.comment,
   'fields',jsonb_build_object('Автор',d.actor_id::text,'Способ',d.origin,'Политика',d.policy),'related',jsonb_build_array('news:'||n.id))
 from academy.news_decisions d join news n on n.id=d.package_id
)
select r.*,concat_ws(' ',title,summary,payload::text) as search_text,
 encode(extensions.digest(jsonb_build_array(entry_key,title,summary,payload,is_current)::text,'sha256'),'hex') as record_hash
from records r;
revoke all on academy.knowledge_records from public,anon,authenticated,service_role;
grant select on academy.knowledge_records to authenticated,service_role;

create function academy.knowledge_search(p_query text default '',p_kind text default 'all',p_page int default 1,p_history boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare total int; page int; items jsonb; begin
 if not academy.is_editor() then raise exception 'Membership required' using errcode='42501'; end if;
 if p_query is null or length(p_query)>200 or p_kind is null or p_kind not in ('all','topic','source','claim','decision','material') or p_page is null or p_page<1 or p_page>100000 or p_history is null then raise exception 'KB_INVALID_INPUT' using errcode='22023'; end if;
 select count(*) into total from academy.knowledge_records r where (p_history or r.is_current) and (p_kind='all' or r.kind=p_kind) and position(lower(trim(p_query)) in lower(r.search_text))>0;
 page:=least(p_page,greatest(1,(total+19)/20));
 select coalesce(jsonb_agg(to_jsonb(s)-'search_text' order by s.created_at desc nulls last,s.entry_key),'[]') into items from (
   select * from academy.knowledge_records r where (p_history or r.is_current) and (p_kind='all' or r.kind=p_kind) and position(lower(trim(p_query)) in lower(r.search_text))>0
   order by r.created_at desc nulls last,r.entry_key limit 20 offset (page-1)*20
 ) s;
 return jsonb_build_object('items',items,'total',total,'page',page,'pages',greatest(1,(total+19)/20));
end $$;
revoke all on function academy.knowledge_search(text,text,int,boolean) from public,anon,service_role;
grant execute on function academy.knowledge_search(text,text,int,boolean) to authenticated;

-- Rules report observable matches, never a model judgment, evidence level or identity merge.
create function academy.knowledge_match_reason(p_kind text,p_title text,p_story uuid,p_payload jsonb,p_target_story uuid,p_content jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select case when p_story=p_target_story then 'Запись относится к этому сюжету; сохраняется её исходный статус.'
   when exists(select 1 from jsonb_array_elements(coalesce(p_payload->'sources','[]')) a,
     jsonb_array_elements(p_content->'sources') b where a->>'url'=b->>'url') then 'Общий URL источника. Это связь для контекста, не независимое подтверждение.'
   when p_kind='topic' and exists(select 1 from jsonb_array_elements_text(coalesce(p_content#>'{en,tags}','[]')||coalesce(p_content#>'{es,tags}','[]')||coalesce(p_content#>'{ru,tags}','[]')||coalesce(p_content#>'{zh-Hans,tags}','[]')) t where lower(trim(t.value))=lower(p_title)) then 'Совпадает тег материала. Тематическая близость не подтверждает выводы.'
   else null end
$$;
revoke all on function academy.knowledge_match_reason(text,text,uuid,jsonb,uuid,jsonb) from public,anon,service_role;
grant execute on function academy.knowledge_match_reason(text,text,uuid,jsonb,uuid,jsonb) to authenticated;

create function academy.knowledge_context_reason(p_package uuid,p_entry text) returns text
language sql stable security invoker set search_path='' as $$
 select academy.knowledge_match_reason(r.kind,r.title,r.story_id,r.payload,p.story_id,p.content)
 from academy.knowledge_records r cross join academy.news_packages p where r.entry_key=p_entry and p.id=p_package
$$;
revoke all on function academy.knowledge_context_reason(uuid,text) from public,anon,service_role;
grant execute on function academy.knowledge_context_reason(uuid,text) to authenticated;

create function academy.knowledge_suggestions(p_package uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$ declare result jsonb; begin
 if not academy.is_editor() then raise exception 'Membership required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
   select r.entry_key,r.kind,r.title,r.record_hash,match.reason
   from academy.knowledge_records r cross join academy.news_packages p
   cross join lateral (select academy.knowledge_match_reason(r.kind,r.title,r.story_id,r.payload,p.story_id,p.content) reason) match
   where p.id=p_package and r.is_current and r.entry_key<>'news:'||p_package and match.reason is not null
   order by (r.kind='source') desc,(r.kind='claim') desc,r.created_at desc nulls last,r.entry_key limit 8
 ) s;return result;
end $$;
revoke all on function academy.knowledge_suggestions(uuid) from public,anon,service_role;
grant execute on function academy.knowledge_suggestions(uuid) to authenticated;

create function academy.knowledge_targets(p_query text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$ declare result jsonb; begin
 if not academy.is_editor() then raise exception 'Membership required' using errcode='42501'; end if;
 if p_query is null or length(p_query)>200 then raise exception 'KB_INVALID_INPUT' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into result from (
   select r.package_id,r.title,r.payload->>'revision' as revision from academy.knowledge_records r
   where r.kind='material' and r.package_id is not null and r.is_current and position(lower(trim(p_query)) in lower(r.search_text))>0
   order by r.created_at desc,r.entry_key limit 20
 ) s;return result;
end $$;
revoke all on function academy.knowledge_targets(text) from public,anon,service_role;
grant execute on function academy.knowledge_targets(text) to authenticated;

create table academy.knowledge_context_decisions (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
 package_id uuid not null references academy.news_packages, package_hash text not null,
 entry_key text not null check(length(entry_key) between 3 and 700), record_hash text not null check(record_hash~'^[a-f0-9]{64}$'),
 entry_snapshot jsonb not null check(octet_length(entry_snapshot::text)<=131072),
 actor_id uuid not null references auth.users, decision text not null check(decision in ('accept','reject')),
 comment text not null check(length(comment)<=4000), rationale text not null, algorithm text not null default 'knowledge-match/1',
 previous_id uuid references academy.knowledge_context_decisions, request_id uuid not null unique, created_at timestamptz not null default now()
);
create index knowledge_context_package on academy.knowledge_context_decisions(package_id,entry_key,sequence desc);
alter table academy.knowledge_context_decisions enable row level security;
revoke all on academy.knowledge_context_decisions from public,anon,authenticated,service_role;
grant select on academy.knowledge_context_decisions to authenticated,service_role;
create policy member_read on academy.knowledge_context_decisions for select to authenticated using((select academy.is_editor()));
create trigger immutable before update or delete on academy.knowledge_context_decisions for each row execute function academy.guard_news_immutable();

-- Deduplicate before the display bound: repeated decisions never hide other saved links.
create function academy.knowledge_context_latest(p_package uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$ declare result jsonb; begin
 if not academy.is_editor() then raise exception 'Membership required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence desc),'[]') into result from (
   select * from (select distinct on(entry_key) * from academy.knowledge_context_decisions where package_id=p_package order by entry_key,sequence desc) latest
   order by sequence desc limit 51
 ) s; return result;
end $$;
revoke all on function academy.knowledge_context_latest(uuid) from public,anon,service_role;
grant execute on function academy.knowledge_context_latest(uuid) to authenticated;

create function academy.knowledge_decide_context(p_package uuid,p_entry text,p_hash text,p_previous uuid,p_request uuid,p_decision text,p_comment text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pkg academy.news_packages; current_package uuid; entry academy.knowledge_records; prior academy.knowledge_context_decisions; existing academy.knowledge_context_decisions; result uuid; begin
 perform academy.require_writing_editor();
 if p_package is null or p_entry is null or length(p_entry) not between 3 and 700 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_request is null or p_decision is null or p_decision not in ('accept','reject') or p_comment is null or length(p_comment)>4000 then raise exception 'KB_INVALID_INPUT' using errcode='22023'; end if;
 -- One lock for request IDs across different target packages, then a target row lock.
 perform pg_advisory_xact_lock(hashtextextended('knowledge-request:'||p_request,0));
 select * into existing from academy.knowledge_context_decisions where request_id=p_request;
 if found then
   if existing.actor_id<>auth.uid() or existing.package_id<>p_package or existing.entry_key<>p_entry or existing.record_hash<>p_hash or existing.previous_id is distinct from p_previous or existing.decision<>p_decision or existing.comment<>p_comment then raise exception 'KB_REQUEST_CONFLICT' using errcode='22023'; end if;
   return existing.id;
 end if;
 select * into pkg from academy.news_packages where id=p_package;
 if not found then raise exception 'KB_PACKAGE_MISSING' using errcode='22023'; end if;
 select package_id into current_package from academy.news_state where story_id=pkg.story_id for update;
 if current_package is distinct from p_package then raise exception 'KB_STALE_PACKAGE' using errcode='40001'; end if;
 select * into entry from academy.knowledge_records where entry_key=p_entry;
 if not found or not entry.is_current or entry.record_hash<>p_hash then raise exception 'KB_STALE_ENTRY' using errcode='40001'; end if;
 if entry.entry_key='news:'||p_package then raise exception 'KB_SELF_REFERENCE' using errcode='22023'; end if;
 select * into prior from academy.knowledge_context_decisions where package_id=p_package and entry_key=p_entry order by sequence desc limit 1;
 if prior.id is distinct from p_previous then raise exception 'KB_STALE_DECISION' using errcode='40001'; end if;
 insert into academy.knowledge_context_decisions(package_id,package_hash,entry_key,record_hash,entry_snapshot,actor_id,decision,comment,rationale,previous_id,request_id)
 values(p_package,pkg.package_hash,p_entry,p_hash,to_jsonb(entry)-'search_text',auth.uid(),p_decision,p_comment,
   coalesce(academy.knowledge_context_reason(p_package,p_entry),'Запись выбрана редактором. Автоматического совпадения источника или тега не найдено.'),p_previous,p_request) returning id into result;
 return result;
end $$;
revoke all on function academy.knowledge_decide_context(uuid,text,text,uuid,uuid,text,text) from public,anon,service_role;
grant execute on function academy.knowledge_decide_context(uuid,text,text,uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
