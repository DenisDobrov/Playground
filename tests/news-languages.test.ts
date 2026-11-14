import {describe, expect, it, vi} from 'vitest';
import type {NextRequest} from 'next/server';
import {normalizeLanguage, preferredLanguage, type Language} from '../apps/web/lib/news-languages';
import {translatedPath} from '../apps/web/lib/news-presentation';
import {articleMetadata, latestNewsReleases, type NewsRelease} from '../apps/web/lib/news-seo';
import {newsFixture} from './fixtures/news';

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => new Response(null, {headers: {'x-middleware-next': '1'}}),
    redirect: (url: URL, status: number) => new Response(null, {status, headers: {location: url.toString()}}),
  },
}));
vi.mock('../apps/web/lib/editorial-config', () => ({
  editorialEnabled: () => false,
  editorialConfig: () => { throw new Error('Public language navigation must not access editorial credentials'); },
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => { throw new Error('Public language navigation must not contact Auth'); },
}));
import {proxy, config as proxyConfig} from '../apps/web/proxy';

const p = newsFixture('a'.repeat(64));
const slug = 'rna-network-2026-11-10';
function release(language: Language, storyId = 'story'): NewsRelease {
  return {id: `${storyId}-${language}`, package_id: 'package', story_id: storyId, language, slug,
    published_at: '2026-11-14T10:00:00Z',
    content: {article: p.en, sources: p.sources, period: p.period, section: p.section, verification: p.verification}};
}
function request(path: string, acceptLanguage: string, saved?: string): NextRequest {
  const url = new URL(path, 'https://dobrov.org');
  return {nextUrl: {pathname: url.pathname, clone: () => new URL(url)},
    headers: new Headers({'accept-language': acceptLanguage}),
    cookies: {get: (name: string) => name === 'da-language' && saved ? {value: saved} : undefined},
  } as unknown as NextRequest;
}

describe('public language negotiation', () => {
  it.each([
    ['ru-RU', 'ru'], ['RU-ru', 'ru'], ['es-MX', 'es'], ['en-GB', 'en'],
    ['zh-CN', 'zh-Hans'], ['zh-Hans', 'zh-Hans'], ['zh-Hans-CN', 'zh-Hans'],
    ['zh-SG', 'zh-Hans'], [' zh-cn ', 'zh-Hans'], ['zh', 'zh-Hans'],
  ])('normalizes %s to the supported edition %s', (tag, expected) => {
    expect(normalizeLanguage(tag)).toBe(expected);
  });

  it.each(['zh-Hant', 'zh-Hant-TW', 'zh-TW', 'fr-FR', '*', '', undefined, null])(
    'does not invent an edition for %s', tag => expect(normalizeLanguage(tag)).toBeUndefined(),
  );

  it('orders browser preferences by quality and retains header order on a tie', () => {
    expect(preferredLanguage(undefined, 'en;q=0.4,ru-RU;q=0.9,es-MX;q=0.7')).toBe('ru');
    expect(preferredLanguage(undefined, 'ru;q=0.7,en;q=0.7')).toBe('ru');
    expect(preferredLanguage(undefined, 'en;q=0.7,ru;q=0.7')).toBe('en');
    expect(preferredLanguage(undefined, 'fr-FR,zh-SG;q=0.8,en;q=0.6')).toBe('zh-Hans');
  });

  it('excludes q=0 and invalid weights rather than letting them override a usable language', () => {
    expect(preferredLanguage(undefined, 'ru-RU;q=0,es-MX;q=0.2,en;q=0.8')).toBe('en');
    expect(preferredLanguage(undefined, 'ru;q=NaN,zh-CN;q=1.2,en;q=-1,es;q=0.5')).toBe('es');
    expect(preferredLanguage(undefined, 'zh-Hant,ru-RU;q=0.6')).toBe('ru');
    expect(preferredLanguage(undefined, null)).toBe('es');
    expect(preferredLanguage(undefined, 'fr-FR,de-DE')).toBe('es');
  });

  it('honours a saved explicit choice over browser preferences', () => {
    expect(preferredLanguage('es', 'ru-RU,zh-CN;q=0.8')).toBe('es');
    expect(preferredLanguage('zh-Hans', 'en,ru;q=0.9')).toBe('zh-Hans');
    expect(preferredLanguage('ru', 'ru;q=0,en;q=1')).toBe('ru');
    expect(preferredLanguage('unrecognised', 'ru-RU')).toBe('ru');
  });

  it('negotiates only the neutral entry and makes the redirect private', async () => {
    const response = await proxy(request('/?from=digest', 'en;q=0.5,ru-RU;q=0.9'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://dobrov.org/ru?from=digest');
    expect(response.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    const manual = await proxy(request('/', 'ru-RU', 'es'));
    expect(manual.status).toBe(307);
    expect(manual.headers.get('location')).toBe('https://dobrov.org/es');
    expect(manual.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(manual.headers.get('cache-control')).toContain('no-store');
    expect(manual.headers.get('x-middleware-next')).toBeNull();
  });

  it.each(['es-MX', 'fr-FR'])('redirects Spanish selection or fallback from %s to /es', async accept => {
    const response = await proxy(request('/?from=digest', accept));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://dobrov.org/es?from=digest');
    expect(response.headers.get('vary')).toBe('Accept-Language, Cookie');
    expect(response.headers.get('cache-control')).toContain('private');
  });

  it.each(['/es', '/en', '/ru', '/zh', '/noticias/' + slug, '/en/news/' + slug,
    '/ru/news/' + slug, '/zh/news/' + slug])(
    'does not redirect an explicit URL %s despite conflicting preferences', async path => {
      const response = await proxy(request(path, 'zh-CN,ru;q=0.9', path === '/es' ? 'ru' : 'es'));
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
    },
  );

  it('keeps public explicit-language paths out of the proxy matcher', () => {
    expect(proxyConfig.matcher).toContain('/');
    for (const path of ['/es/:path*', '/en/:path*', '/ru/:path*', '/zh/:path*', '/noticias/:path*']) {
      expect(proxyConfig.matcher).not.toContain(path);
    }
  });
});

describe('language switching preserves the article and section', () => {
  it.each([
    ['/noticias/' + slug, 'en', '/en/news/' + slug],
    ['/en/news/' + slug, 'ru', '/ru/news/' + slug],
    ['/ru/news/' + slug, 'zh-Hans', '/zh/news/' + slug],
    ['/zh/news/' + slug, 'es', '/noticias/' + slug],
    ['/ru/topics/quantum', 'zh-Hans', '/zh/topics/quantum'],
    ['/zh/week/2026-11-07', 'es', '/semana/2026-11-07'],
    ['/politica', 'ru', '/ru/method'],
    ['/ru', 'en', '/en'],
    ['/en', 'es', '/es'],
    ['/es', 'ru', '/ru'],
    ['/es', 'es', '/es'],
    ['/ru/news/' + slug, 'ru', '/ru/news/' + slug],
  ] as const)('maps %s into %s without losing its suffix', (from, to, expected) => {
    expect(translatedPath(from, to)).toBe(expected);
  });
});

describe('hreflang represents actual released translations', () => {
  it('advertises all four editions only when the story has all four releases', () => {
    const rows = latestNewsReleases(['es', 'en', 'ru', 'zh-Hans'].map(l => release(l as Language)));
    const metadata = articleMetadata(rows.find(r => r.language === 'ru')!);
    expect(metadata.alternates).toEqual({canonical: `https://dobrov.org/ru/news/${slug}`, languages: {
      es: `https://dobrov.org/noticias/${slug}`, en: `https://dobrov.org/en/news/${slug}`,
      ru: `https://dobrov.org/ru/news/${slug}`, 'zh-Hans': `https://dobrov.org/zh/news/${slug}`,
      'x-default': `https://dobrov.org/noticias/${slug}`,
    }});
    expect(metadata.openGraph).toMatchObject({locale: 'ru_RU', alternateLocale: ['es', 'en_GB', 'zh_CN']});
  });

  it('does not borrow a missing translation from a different story or advertise an unapproved draft', () => {
    const rows = latestNewsReleases([release('es'), release('ru'), release('zh-Hans', 'other-story')]);
    const current = rows.find(r => r.story_id === 'story' && r.language === 'ru')!;
    expect(current.availableLanguages).toEqual(['es', 'ru']);
    const metadata = articleMetadata(current);
    expect(metadata.alternates?.languages).toEqual({
      es: `https://dobrov.org/noticias/${slug}`, ru: `https://dobrov.org/ru/news/${slug}`,
      'x-default': `https://dobrov.org/noticias/${slug}`,
    });
    expect(metadata.openGraph).toMatchObject({alternateLocale: ['es']});
  });

  it('does not invent Spanish or x-default when only a non-Spanish release exists', () => {
    const metadata = articleMetadata(release('zh-Hans'));
    expect(metadata.alternates).toEqual({canonical: `https://dobrov.org/zh/news/${slug}`,
      languages: {'zh-Hans': `https://dobrov.org/zh/news/${slug}`}});
    expect(metadata.openGraph).toMatchObject({locale: 'zh_CN', alternateLocale: []});
  });
});
