'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireMember} from '../../../../lib/editorial-auth';
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
