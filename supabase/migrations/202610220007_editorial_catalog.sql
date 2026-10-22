-- Read-only catalog: underlying RLS applies to the caller, including aggregate text.
create view academy.editorial_catalog with (security_invoker = true) as
select s.id, s.created_at, s.status, s.editorial_version,
  coalesce(domains.ids, '{}'::text[]) as domain_ids,
  latest.decision as latest_decision,
  concat_ws(' ', s.title_en, sources.identifiers, reasons.text) as search_text
from academy.stories s
left join lateral (
  select array_agg(d.domain_id) as ids from academy.story_domains d where d.story_id = s.id
) domains on true
left join lateral (
  select string_agg(concat_ws(' ', src.canonical_id, aliases.identifiers), ' ') as identifiers
  from academy.story_sources link join academy.sources src on src.id = link.source_id
  left join lateral (
    select string_agg(a.alias, ' ') as identifiers from academy.source_aliases a where a.source_id = src.id
  ) aliases on true
  where link.story_id = s.id
) sources on true
left join lateral (
  select d.decision from academy.editorial_decisions d
  where d.story_id = s.id and d.actor_type = 'human' and d.decision in ('select','reject','hold','revise')
  order by d.created_at desc, d.id desc limit 1
) latest on true
left join lateral (
  select string_agg(d.reason, ' ') as text from academy.editorial_decisions d
  where d.story_id = s.id and d.actor_type = 'human'
) reasons on true;
revoke all on academy.editorial_catalog from public, anon, authenticated;
grant select on academy.editorial_catalog to authenticated, service_role;
notify pgrst, 'reload schema';
