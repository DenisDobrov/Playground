import {describe, expect, it} from 'vitest';
import {homePath, type Language} from '../apps/web/lib/news-languages';
import {articleMetadata, latestNewsReleases, newsArticleJsonLd, resolveNewsRelease, type NewsRelease} from '../apps/web/lib/news-seo';
import {filterPublicView} from '../apps/web/lib/public-analytics';
import {newsFixture} from './fixtures/news';

const p = newsFixture('a'.repeat(64));
function release(language: Language, slug: string, story = 'story-a', published = '2026-11-14T10:00:00Z'): NewsRelease {
  return {id: `${story}-${language}-${slug}`, package_id: `package-${slug}`, story_id: story, language, slug,
    published_at: published,
    content: {article: p.en, sources: p.sources, period: p.period, section: p.section, verification: p.verification}};
}
function differingSlugs() {
  return latestNewsReleases([
    release('es', 'old-spanish', 'story-a', '2026-11-07T10:00:00Z'),
    release('es', 'current-spanish'), release('en', 'current-english'),
    release('ru', 'earlier-russian', 'story-a', '2026-11-07T10:00:00Z'),
    release('zh-Hans', 'unrelated-chinese', 'story-b'),
  ]);
}

describe('released translation identity and canonical links', () => {
  it('uses each latest released translation path without borrowing another story or an obsolete revision', () => {
    const rows = differingSlugs();
    for (const row of rows.filter(r => r.story_id === 'story-a')) {
      expect(row.availableLanguages).toEqual(['es', 'en', 'ru']);
      expect(row.languagePaths).toEqual({es: '/noticias/current-spanish', en: '/en/news/current-english', ru: '/ru/news/earlier-russian'});
    }
    expect(rows.find(r => r.story_id === 'story-b')?.languagePaths).toEqual({'zh-Hans': '/zh/news/unrelated-chinese'});
  });

  it.each([
    ['ru', 'current-spanish', 'earlier-russian'],
    ['en', 'earlier-russian', 'current-english'],
    ['es', 'current-english', 'current-spanish'],
  ] as const)('resolves %s from the retained %s URL to the same story translation', (language, slug, expected) => {
    expect(resolveNewsRelease(differingSlugs(), language, slug)).toMatchObject({story_id: 'story-a', language, slug: expected});
  });

  it('keeps metadata, canonical and structured data on the actual released translation', () => {
    const row = resolveNewsRelease(differingSlugs(), 'ru', 'current-spanish')!;
    const metadata = articleMetadata(row);
    expect(metadata.alternates).toEqual({canonical: 'https://dobrov.org/ru/news/earlier-russian', languages: {
      es: 'https://dobrov.org/noticias/current-spanish', en: 'https://dobrov.org/en/news/current-english',
      ru: 'https://dobrov.org/ru/news/earlier-russian', 'x-default': 'https://dobrov.org/noticias/current-spanish',
    }});
    expect(metadata.openGraph).toMatchObject({url: 'https://dobrov.org/ru/news/earlier-russian'});
    expect(newsArticleJsonLd(row)).toMatchObject({url: 'https://dobrov.org/ru/news/earlier-russian', inLanguage: 'ru'});
  });

  it('falls back within the requested story when the language is absent', () => {
    const rows = differingSlugs();
    const fallback = resolveNewsRelease(rows, 'zh-Hans', 'earlier-russian')!;
    expect(fallback).toMatchObject({story_id: 'story-a', language: 'es', slug: 'current-spanish'});
    expect(articleMetadata(fallback).alternates?.canonical).toBe('https://dobrov.org/noticias/current-spanish');
    expect(resolveNewsRelease(rows, 'ru', 'unrelated-chinese')).toMatchObject({story_id: 'story-b', language: 'zh-Hans'});
    expect(resolveNewsRelease(rows, 'ru', 'never-published')).toBeUndefined();
  });

  it('prefers an exact language URL over a matching slug on another story', () => {
    const rows = latestNewsReleases([release('es', 'shared-slug'), release('ru', 'shared-slug', 'story-b')]);
    expect(resolveNewsRelease(rows, 'ru', 'shared-slug')).toMatchObject({story_id: 'story-b', language: 'ru'});
  });

  it('uses the explicit Spanish home as the stable language destination', () => {
    expect(homePath('es')).toBe('/es');
  });
});

describe('analytics for released international paths', () => {
  it.each([
    '/es', '/en', '/ru', '/zh', '/ru/news/earlier-russian', '/zh/news/research',
    '/politica', '/ru/method', '/zh/method',
    '/semana/2026-11-01', '/en/week/2026-11-01', '/semana/2026-11-07',
    '/en/week/2026-11-07', '/ru/week/2026-11-07', '/zh/week/2026-11-07',
  ])('accepts the exact public path %s while removing sensitive query and fragment data', path => {
    const currentUrl = `https://dobrov.org${path}?email=private#token`;
    expect(filterPublicView({type: 'pageview', url: currentUrl}, path, {currentUrl, referrer: ''}))
      .toEqual({type: 'pageview', url: `https://dobrov.org${path}`});
  });

  it.each(['/es/editorial', '/ru/editorial/news', '/zh/auth/callback', '/ru/news/research/private', '/zh/week/2026-11-07/private'])
    ('rejects non-public or appended paths %s', path => {
      const currentUrl = `https://dobrov.org${path}`;
      expect(filterPublicView({type: 'pageview', url: currentUrl}, path, {currentUrl, referrer: ''})).toBeNull();
    });

  it('retains opt-outs, exact-path validation and private-referrer protection on the new paths', () => {
    const path = '/zh/week/2026-11-07', currentUrl = `https://dobrov.org${path}`;
    const event = {type: 'pageview' as const, url: currentUrl};
    for (const privacy of [{doNotTrack: '1'}, {globalPrivacyControl: true}, {referrer: 'https://dobrov.org/editorial/news'}]) {
      expect(filterPublicView(event, path, {currentUrl, referrer: '', ...privacy})).toBeNull();
    }
    expect(filterPublicView(event, '/ru/week/2026-11-07', {currentUrl, referrer: ''})).toBeNull();
  });
});
