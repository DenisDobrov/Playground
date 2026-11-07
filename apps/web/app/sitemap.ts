import type {MetadataRoute} from 'next';
import {digestPath,newsOrigin,newsPath,newsReleases} from '../lib/news';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const rows=await newsReleases();
  if(!rows.length)return [];
  return [...rows.map(r=>({url:newsOrigin+newsPath(r.language,r.slug),lastModified:r.published_at,alternates:{languages:{en:newsOrigin+newsPath('en',r.slug),es:newsOrigin+newsPath('es',r.slug)}}})),...(['en','es'] as const).map(lang=>({url:newsOrigin+digestPath(lang)}))];
}
