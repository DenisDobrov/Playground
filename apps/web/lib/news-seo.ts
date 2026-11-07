import type {Metadata} from 'next';
import type {NewsPackage} from '@science/core';

export const newsOrigin = 'https://dobrov.org';
export const newsPath = (language: 'en'|'es', slug: string) => `${language === 'en' ? '/en/news' : '/noticias'}/${slug}`;
export const digestPath = (language: 'en'|'es') => language === 'en' ? '/en/week/2026-11-01' : '/semana/2026-11-01';
export const methodPath = (language:'en'|'es') => language === 'en' ? '/en/method' : '/politica';
export const shareImage = (language:'en'|'es',slug:string) => `${newsOrigin}/share/${language}/${encodeURIComponent(slug)}`;
export interface NewsRelease {
  id: string; package_id: string; story_id: string; language: 'en'|'es'; slug: string; published_at: string;
  first_published_at?: string; modified_at?: string;
  content: {article: NewsPackage['en']; sources: NewsPackage['sources']; period: string; section: number; verification: NewsPackage['verification']};
}

/** Campaign-only reapproval does not make an unchanged public article newly published. */
export function latestNewsReleases(rows:NewsRelease[]):NewsRelease[] {
  const latest=new Map<string,NewsRelease>();
  for(const release of [...rows].sort((a,b)=>a.published_at.localeCompare(b.published_at)||a.id.localeCompare(b.id))){
    const key=`${release.story_id}:${release.language}`, previous=latest.get(key);
    latest.set(key,{...release,first_published_at:previous?.first_published_at??release.published_at,
      modified_at:previous&&JSON.stringify(previous.content)===JSON.stringify(release.content)&&previous.slug===release.slug
        ?previous.modified_at:release.published_at});
  }
  return [...latest.values()];
}
export function shortDescription(text:string):string {
  const plain=text.replace(/\s+/g,' ').trim();
  if(plain.length<=180)return plain;
  return plain.slice(0,177).replace(/\s+\S*$/,'')+'…';
}
export function newsMetadata(language:'en'|'es',title:string,description:string,paths:{en:string;es:string},article?:{publishedTime:string;modifiedTime:string;image:string}):Metadata {
  const summary=shortDescription(description),image=article?.image??`${newsOrigin}/share`;
  return {title,description:summary,robots:{index:true,follow:true},alternates:{canonical:newsOrigin+paths[language],languages:{en:newsOrigin+paths.en,es:newsOrigin+paths.es,'x-default':newsOrigin+paths.es}},
    openGraph:{title,description:summary,url:newsOrigin+paths[language],siteName:'Dobrov Academy',locale:language==='en'?'en_US':'es_ES',alternateLocale:language==='en'?'es_ES':'en_US',type:article?'article':'website',images:[{url:image,width:1200,height:630,alt:title}],...(article?{publishedTime:article.publishedTime,modifiedTime:article.modifiedTime}: {})},
    twitter:{card:'summary_large_image',title,description:summary,images:[image]}};
}
export function articleMetadata(r:NewsRelease):Metadata {
  return newsMetadata(r.language,r.content.article.title,r.content.article.paragraphs[0],{en:newsPath('en',r.slug),es:newsPath('es',r.slug)},
    {publishedTime:r.first_published_at??r.published_at,modifiedTime:r.modified_at??r.published_at,image:shareImage(r.language,r.slug)});
}
export function newsArticleJsonLd(r:NewsRelease) {
  const url=newsOrigin+newsPath(r.language,r.slug);
  return {'@context':'https://schema.org','@type':r.content.article.type==='analysis'?'Article':'NewsArticle','@id':`${url}#article`,url,mainEntityOfPage:url,headline:r.content.article.title,
    description:shortDescription(r.content.article.paragraphs[0]),inLanguage:r.language,image:[shareImage(r.language,r.slug)],
    datePublished:r.first_published_at??r.published_at,dateModified:r.modified_at??r.published_at,isAccessibleForFree:true,
    author:{'@type':'Organization',name:'Dobrov Academy',url:newsOrigin+methodPath(r.language)},
    publisher:{'@type':'Organization',name:'Dobrov Academy',url:newsOrigin},citation:r.content.sources.map(s=>s.url)};
}
/** Published source text is still untrusted; it must never terminate a script element. */
export const serializeJsonLd=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
