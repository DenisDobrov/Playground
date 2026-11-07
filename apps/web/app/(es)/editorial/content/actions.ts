'use server';
import {requireMember} from '../../../../lib/editorial-auth';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export async function reviewContent(form:FormData) {
 const {client}=await requireMember();const get=(k:string)=>String(form.get(k)||'');let notice='saved';
 const checks=Object.fromEntries(['claimAlignment','languageQuality','scientificCaveats','quantitativeValues'].map(k=>[k,form.get(k)==='on']));
 const result=await client.rpc('review_content_draft',{p_draft:get('draft'),p_hash:get('hash'),p_input_hash:get('inputHash'),p_decision:get('decision'),p_checks:checks,p_reason:get('reason'),p_expected:Number(get('expected')),p_command:get('commandId')});
 if(result.error)notice=result.error.code==='40001'?'stale':'blocked';
 revalidatePath('/editorial/content');redirect('/editorial/content?draft='+encodeURIComponent(get('draft'))+'&notice='+notice);
}
