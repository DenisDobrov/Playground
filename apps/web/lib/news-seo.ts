import type {Metadata} from 'next';
import type {NewsPackage} from '@science/core';
import {homePath,languageLocale,languages,type Language} from './news-languages';

export const newsOrigin = 'https://dobrov.org';
export const newsPath = (language:Language, slug:string) => `${language==='es'?'/noticias':homePath(language)+'/news'}/${slug}`;
export const digestPath = (language:Language,start='2026-11-01') => `${language==='es'?'/semana':homePath(language)+'/week'}/${start}`;
export const methodPath = (language:Language) => language==='es'?'/politica':homePath(language)+'/method';
export const shareImage = (language:Language,slug:string) => `${newsOrigin}/share/${language}/${encodeURIComponent(slug)}`;
export interface NewsRelease {
  id: string; package_id: string; story_id: string; language:Language; slug: string; published_at: string;
  availableLanguages?:Language[];
  languagePaths?:Partial<Record<Language,string>>;
  first_published_at?: string; modified_at?: string;
  content: {article: NewsPackage['en']; sources: NewsPackage['sources']; period: string; section: number; verification: NewsPackage['verification'];eventDates?:NonNullable<NewsPackage['research']>['eventDates']};
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
  const releases=[...latest.values()];
  return releases.map(r=>({...r,availableLanguages:languages.filter(l=>releases.some(other=>other.story_id===r.story_id&&other.language===l)),languagePaths:Object.fromEntries(releases.filter(other=>other.story_id===r.story_id).map(other=>[other.language,newsPath(other.language,other.slug)]))}));
}
/** A retained URL in another language still resolves the canonical story, never a different article. */
export function resolveNewsRelease(rows:NewsRelease[],language:Language,slug:string){
 const seed=rows.find(r=>r.slug===slug&&r.language===language)??rows.find(r=>r.slug===slug);
 return seed?(rows.find(r=>r.story_id===seed.story_id&&r.language===language)??rows.find(r=>r.story_id===seed.story_id&&r.language==='es')??seed):undefined;
}
export function shortDescription(text:string):string {
  const plain=text.replace(/\s+/g,' ').trim();
  if(plain.length<=180)return plain;
  return plain.slice(0,177).replace(/\s+\S*$/,'')+'…';
}
export function newsMetadata(language:Language,title:string,description:string,paths:Partial<Record<Language,string>>,article?:{publishedTime:string;modifiedTime:string;image:string}):Metadata {
  const summary=shortDescription(description),image=article?.image??`${newsOrigin}/share`;
  const alternatives=Object.fromEntries(Object.entries(paths).map(([l,p])=>[l,newsOrigin+p]));
  if(paths.es)alternatives['x-default']=newsOrigin+paths.es;
  return {title,description:summary,robots:{index:true,follow:true},alternates:{canonical:newsOrigin+paths[language],languages:alternatives},
    openGraph:{title,description:summary,url:newsOrigin+paths[language],siteName:'Dobrov Academy',locale:languageLocale[language].replace('-','_'),alternateLocale:languages.filter(l=>l!==language&&paths[l]).map(l=>languageLocale[l].replace('-','_')),type:article?'article':'website',images:[{url:image,width:1200,height:630,alt:title}],...(article?{publishedTime:article.publishedTime,modifiedTime:article.modifiedTime}: {})},
    twitter:{card:'summary_large_image',title,description:summary,images:[image]}};
}
export function articleMetadata(r:NewsRelease):Metadata {
  return newsMetadata(r.language,r.content.article.seo?.title??r.content.article.title,r.content.article.seo?.description??r.content.article.paragraphs[0],r.languagePaths??Object.fromEntries((r.availableLanguages??[r.language]).map(l=>[l,newsPath(l,r.slug)])),
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
