-- Approval refers to immutable versions. Publication timestamps may change.
create function academy.guard_immutable_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Revisions cannot be deleted; create a correction';
  end if;
  if (to_jsonb(new) - 'published_at') is distinct from (to_jsonb(old) - 'published_at') then
    raise exception 'Revisions are immutable; create a new version';
  end if;
  return new;
end $$;
revoke all on function academy.guard_immutable_revision() from public;
create trigger immutable_articles before update or delete on academy.articles
  for each row execute function academy.guard_immutable_revision();
create trigger immutable_scripts before update or delete on academy.scripts
  for each row execute function academy.guard_immutable_revision();
create trigger immutable_dossiers before update or delete on academy.dossiers
  for each row execute function academy.guard_immutable_revision();
