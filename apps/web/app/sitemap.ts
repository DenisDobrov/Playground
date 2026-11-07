import type {MetadataRoute} from 'next';
import {digestPath,newsOrigin,newsPath,newsReleases} from '../lib/news';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const rows=await newsReleases();
  if(!rows.length)return [];
  const pair=(en:string,es:string)=>({en:newsOrigin+en,es:newsOrigin+es,'x-default':newsOrigin+es});
  return [...rows.map(r=>({url:newsOrigin+newsPath(r.language,r.slug),lastModified:r.modified_at??r.published_at,alternates:{languages:pair(newsPath('en',r.slug),newsPath('es',r.slug))}})),
    ...[{en:'/en',es:'/'},{en:digestPath('en'),es:digestPath('es')},{en:'/en/method',es:'/politica'}].flatMap(paths=>(['en','es'] as const).map(lang=>({url:newsOrigin+paths[lang],alternates:{languages:pair(paths.en,paths.es)}})))];
}
