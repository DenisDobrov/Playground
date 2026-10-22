-- Existing revisions remain Spanish; each language has an independent revision sequence.
alter table academy.articles add column language text not null default 'es' check(language in ('es','en'));
alter table academy.articles drop constraint articles_story_id_version_key;
alter table academy.articles add constraint articles_story_language_version_key unique(story_id,language,version);
-- Existing immutable trigger and publication/review references to exact article IDs remain in force.
comment on column academy.articles.ai_disclosure_es is 'Legacy physical column name: disclosure text in articles.language. Rename only with an explicit repository migration.';
