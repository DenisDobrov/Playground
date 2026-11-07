import {describe,it,expect} from 'vitest';
import {newsFixture} from './fixtures/news';
import {articleMetadata,latestNewsReleases,newsArticleJsonLd,serializeJsonLd,shortDescription,type NewsRelease} from '../apps/web/lib/news-seo';
import {filterPublicView,publicAnalyticsEnabled} from '../apps/web/lib/public-analytics';
const p=newsFixture('a'.repeat(64));
const release:NewsRelease={id:'1',package_id:'p1',story_id:'s1',language:'es',slug:p.slug,published_at:'2026-11-06T00:00:00Z',content:{article:p.es,sources:p.sources,period:p.period,section:p.section,verification:p.verification}};
describe('public news metadata',()=>{
  it('preserves first publication and modification dates on campaign-only reapproval',()=>{
    const r=latestNewsReleases([{...release,id:'2',package_id:'campaign',published_at:'2026-11-07T00:00:00Z'},release])[0];
    expect(r).toMatchObject({id:'2',first_published_at:release.published_at,modified_at:release.published_at});
    expect(newsArticleJsonLd(r)).toMatchObject({datePublished:release.published_at,dateModified:release.published_at});
  });
  it('updates modified date for an actual public correction, never changes initial publication or mixes languages',()=>{
    const rows=latestNewsReleases([release,{...release,id:'2',language:'en'}, {...release,id:'3',published_at:'2026-11-07T00:00:00Z',content:{...release.content,article:{...release.content.article,limitations:'Corrected caveat'}}}]);
    expect(rows).toHaveLength(2);expect(rows.find(r=>r.language==='es')).toMatchObject({first_published_at:release.published_at,modified_at:'2026-11-07T00:00:00Z'});
    expect(rows.find(r=>r.language==='en')?.modified_at).toBe(release.published_at);
  });
  it('emits absolute language-specific large images, canonicals, sources and real organization authorship',()=>{
    const meta=articleMetadata(release),json=newsArticleJsonLd(release);
    expect(meta.twitter).toMatchObject({card:'summary_large_image',images:[`https://dobrov.org/share/es/${p.slug}`]});
    expect(meta.alternates).toMatchObject({canonical:`https://dobrov.org/noticias/${p.slug}`});
    expect(json.citation).toEqual(p.sources.map(s=>s.url));expect(json.author['@type']).toBe('Organization');expect(json).not.toHaveProperty('reviewedBy');
    expect(shortDescription('word '.repeat(100)).length).toBeLessThanOrEqual(180);
  });
  it('prevents source text from injecting markup via structured data',()=>{
    const text={headline:'</script><script>alert(1)</script>'};const encoded=serializeJsonLd(text);
    expect(encoded).not.toContain('<');expect(JSON.parse(encoded)).toEqual(text);
  });
});
describe('free public-only analytics',()=>{
  const path='/noticias/research',ctx={currentUrl:'https://dobrov.org'+path,referrer:''};
  it('removes query and fragments while allowing only the exact released page',()=>{
    expect(filterPublicView({type:'pageview',url:ctx.currentUrl+'?token=secret#email'},path,{...ctx,currentUrl:ctx.currentUrl+'?token=secret#email'})).toEqual({type:'pageview',url:ctx.currentUrl});
    expect(filterPublicView({type:'pageview',url:ctx.currentUrl},'/noticias/another',ctx)).toBeNull();
  });
  it('does not count private navigation, previews, demo, custom events or privacy opt-outs',()=>{
    for(const privatePath of ['/editorial','/editorial/news','/login','/auth/callback','/api/readiness','/unknown']){
      expect(filterPublicView({type:'pageview',url:'https://dobrov.org'+privatePath},privatePath,{...ctx,currentUrl:'https://dobrov.org'+privatePath})).toBeNull();
      expect(filterPublicView({type:'pageview',url:ctx.currentUrl},path,{...ctx,currentUrl:'https://dobrov.org'+privatePath})).toBeNull();
    }
    for(const changed of [{currentUrl:'https://preview.vercel.app'+path},{currentUrl:'http://localhost:3000'+path},{doNotTrack:'1'},{globalPrivacyControl:true}])expect(filterPublicView({type:'pageview',url:ctx.currentUrl},path,{...ctx,...changed})).toBeNull();
    expect(filterPublicView({type:'event',url:ctx.currentUrl},path,ctx)).toBeNull();
    expect(publicAnalyticsEnabled('preview',true)).toBe(false);expect(publicAnalyticsEnabled('production',false)).toBe(false);expect(publicAnalyticsEnabled('production',true)).toBe(true);
  });
  it('drops referrers containing queries, fragments or private paths instead of leaking them',()=>{
    for(const referrer of ['https://example.org/?email=private','https://dobrov.org/auth/callback','https://example.org/#token','invalid'])expect(filterPublicView({type:'pageview',url:ctx.currentUrl},path,{...ctx,referrer})).toBeNull();
    expect(filterPublicView({type:'pageview',url:ctx.currentUrl},path,{...ctx,referrer:'https://www.instagram.com/'})).not.toBeNull();
  });
});
