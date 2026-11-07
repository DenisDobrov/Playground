import type {MetadataRoute} from 'next';
import {digestPath,newsOrigin,newsPath,newsReleases} from '../lib/news';
import {topics,hasTopic,topicPath,publicListingPath,type NewsTopic} from '../lib/news-presentation';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const rows=await newsReleases();
  if(!rows.length)return [];
  const pair=(en:string,es:string)=>({en:newsOrigin+en,es:newsOrigin+es,'x-default':newsOrigin+es});
  const listings=['news','topics',...(rows.some(r=>r.content.article.type==='analysis')?['analysis']:[]),...(rows.some(r=>r.content.period==='2026-11-01/2026-11-07')?['archive']:[])] as ('news'|'topics'|'analysis'|'archive')[];
  const paths=[{en:'/en',es:'/'},{en:'/en/method',es:'/politica'},...(rows.some(r=>r.content.period==='2026-11-01/2026-11-07')?[{en:digestPath('en'),es:digestPath('es')}]:[]),...listings.map(kind=>({en:publicListingPath('en',kind),es:publicListingPath('es',kind)})),...Object.keys(topics).filter(t=>rows.some(r=>hasTopic(r,t))).map(t=>({en:topicPath('en',t as NewsTopic),es:topicPath('es',t as NewsTopic)}))];
  return [...rows.map(r=>({url:newsOrigin+newsPath(r.language,r.slug),lastModified:r.modified_at??r.published_at,alternates:{languages:pair(newsPath('en',r.slug),newsPath('es',r.slug))}})),
    ...paths.flatMap(paths=>(['en','es'] as const).map(lang=>({url:newsOrigin+paths[lang],alternates:{languages:pair(paths.en,paths.es)}})))];
}
