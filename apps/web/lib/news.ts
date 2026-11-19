import 'server-only';
import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {editorialConfig, editorialEnabled} from './editorial-config';
import {latestNewsReleases,type NewsRelease} from './news-seo';
import {isYouTubeId,type NewsMedia} from './youtube-links';
import {languages} from './news-languages';
export * from './news-seo';
/** Anonymous client deliberately has no session. Only persisted release snapshots are public. */
export const newsReleases = cache(async (): Promise<NewsRelease[]> => {
  if (!editorialEnabled()) return [];
  const {url, key} = editorialConfig();
  const client = createClient(url,key,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});
  const result = await client.from('news_releases').select('id,package_id,story_id,language,slug,published_at,content').order('published_at',{ascending:false}).order('id').limit(1000);
  if (result.error) throw new Error('Published news is temporarily unavailable');
  // Fail explicitly instead of silently inventing a first-publication date from truncated history.
  if(result.data?.length===1000)throw new Error('Published news history requires pagination');
  return latestNewsReleases((result.data || []) as NewsRelease[]);
});

/** Anonymous, narrow projection: unpublished Stories and private metadata never enter this DTO. */
export const publishedNewsMedia=cache(async(storyId:string):Promise<NewsMedia|null>=>{
 if(!editorialEnabled())return null;
 const {url,key}=editorialConfig();
 const client=createClient(url,key,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(5000)})}});
 const {data,error}=await client.from('news_public_media').select('youtube_id,youtube_language,youtube_configured').eq('story_id',storyId).maybeSingle();
 if(error)throw Error('Related video metadata is temporarily unavailable');
 if(!data)return null;
 if(typeof data.youtube_configured!=='boolean'||(data.youtube_id!==null&&!isYouTubeId(data.youtube_id))||(data.youtube_language!==null&&!languages.includes(data.youtube_language))||(data.youtube_id===null&&data.youtube_language!==null))throw Error('Invalid related video metadata');
 return data as NewsMedia;
});
