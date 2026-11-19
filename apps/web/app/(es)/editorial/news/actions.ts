'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireMember} from '../../../../lib/editorial-auth';
import {normalizeYouTubeUrl} from '../../../../lib/youtube-links';
const input=z.object({package:z.uuid(),request:z.uuid(),version:z.coerce.number().int().nonnegative(),decision:z.enum(['approve','reject']),comment:z.string().max(4000),video:z.boolean(),science:z.boolean()});
export async function decideNews(form:FormData) {
  const {client}=await requireMember(true);
  const parsed=input.safeParse({package:form.get('package'),request:form.get('request'),version:form.get('version'),decision:form.get('decision'),comment:form.get('comment')??'',video:form.get('video')==='on',science:form.get('science')==='on'});
  if(!parsed.success)redirect('/editorial/news?notice=invalid');
  const v=parsed.data;
  const {error}=await client.rpc('news_decide',{p_package:v.package,p_expected_version:v.version,p_request:v.request,p_decision:v.decision,p_comment:v.comment,p_video:v.video,p_science:v.science});
  if(error)redirect('/editorial/news?notice='+(error.code==='40001'?'conflict':'failed'));
  revalidatePath('/','layout');
  redirect('/editorial/news?notice=saved');
}

const mediaInput=z.object({story:z.uuid(),request:z.uuid(),version:z.coerce.number().int().nonnegative(),url:z.string().max(2048),language:z.enum(['','es','en','ru','zh-Hans']),action:z.enum(['save','remove'])});
export async function saveNewsYouTube(form:FormData){
 const {client}=await requireMember(true);
 const parsed=mediaInput.safeParse({story:form.get('story'),request:form.get('request'),version:form.get('mediaVersion'),url:form.get('youtubeUrl')??'',language:form.get('youtubeLanguage')??'',action:form.get('mediaAction')??'save'});
 if(!parsed.success)redirect('/editorial/news?notice=media_invalid');
 const v=parsed.data;
 const state=await client.from('news_state').select('package:news_packages!news_state_package_id_fkey(slug)').eq('story_id',v.story).single();
 if(state.error)redirect('/editorial/news?notice=failed');
 const slug=(state.data.package as unknown as {slug:string}).slug;
 const back='/editorial/news?'+new URLSearchParams({view:'all',q:slug}).toString();
 let video:ReturnType<typeof normalizeYouTubeUrl>;
 try{video=normalizeYouTubeUrl(v.action==='remove'?'':v.url);}catch{redirect(back+'&notice=media_invalid');}
 const {error}=await client.rpc('news_set_youtube',{p_story:v.story,p_expected_version:v.version,p_request:v.request,p_youtube_id:video?.id??null,p_language:video&&v.language?v.language:null});
 if(error)redirect(back+'&notice='+(error.code==='40001'?'media_conflict':'failed'));
 revalidatePath('/','layout');
 redirect(back+'&notice=media_saved#story-'+v.story);
}
