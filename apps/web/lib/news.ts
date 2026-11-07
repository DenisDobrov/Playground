import 'server-only';
import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import type {Metadata} from 'next';
import type {NewsPackage} from '@science/core';
import {editorialConfig, editorialEnabled} from './editorial-config';

export const newsOrigin = 'https://dobrov.org';
export const newsPath = (language: 'en'|'es', slug: string) => `${language === 'en' ? '/en/news' : '/noticias'}/${slug}`;
export const digestPath = (language: 'en'|'es') => language === 'en' ? '/en/week/2026-11-01' : '/semana/2026-11-01';
export interface NewsRelease {
  id: string; package_id: string; story_id: string; language: 'en'|'es'; slug: string; published_at: string;
  content: {article: NewsPackage['en']; sources: NewsPackage['sources']; period: string; section: number; verification: NewsPackage['verification']};
}
/** Anonymous client deliberately has no session. Only persisted release snapshots are public. */
export const newsReleases = cache(async (): Promise<NewsRelease[]> => {
  if (!editorialEnabled()) return [];
  const {url, key} = editorialConfig();
  const client = createClient(url,key,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});
  const result = await client.from('news_releases').select('id,package_id,story_id,language,slug,published_at,content').order('published_at',{ascending:false}).order('id').limit(1000);
  if (result.error) throw new Error('Published news is temporarily unavailable');
  const latest = new Map<string,NewsRelease>();
  for (const release of (result.data || []) as NewsRelease[]) {
    const key = `${release.story_id}:${release.language}`;
    if (!latest.has(key)) latest.set(key,release);
  }
  return [...latest.values()];
});
export function newsMetadata(language:'en'|'es', title:string, description:string, paths:{en:string;es:string}, publishedTime?:string): Metadata {
  return {title,description,robots:{index:true,follow:true},alternates:{canonical:newsOrigin+paths[language],languages:{en:newsOrigin+paths.en,es:newsOrigin+paths.es,'x-default':newsOrigin+paths.es}},openGraph:{title,description,url:newsOrigin+paths[language],siteName:'Dobrov Academy',locale:language==='en'?'en_US':'es_ES',alternateLocale:language==='en'?'es_ES':'en_US',type:publishedTime?'article':'website',...(publishedTime?{publishedTime}:{})},twitter:{card:'summary',title,description}};
}
