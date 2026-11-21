'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {knowledgeDecisionInput,knowledgeUrl} from '@science/core';
import {requireMember} from '../../../../lib/editorial-auth';

export async function decideKnowledgeContext(form:FormData){
 const {client}=await requireMember(true);
 const parsed=knowledgeDecisionInput.safeParse({package:form.get('package'),entry:form.get('entry'),hash:form.get('hash'),
   previous:form.get('previous')||null,request:form.get('request'),decision:form.get('decision'),comment:form.get('comment')??''});
 if(!parsed.success)redirect('/editorial/knowledge?notice=invalid');
 const input=parsed.data,back=knowledgeUrl({mode:'context',package:input.package,entry:input.entry});
 const result=await client.rpc('knowledge_decide_context',{p_package:input.package,p_entry:input.entry,p_hash:input.hash,p_previous:input.previous,
   p_request:input.request,p_decision:input.decision,p_comment:input.comment});
 if(result.error)redirect(back+'&notice='+(result.error.code==='40001'?'conflict':'failed'));
 revalidatePath('/editorial/knowledge');
 redirect(back+'&notice=saved');
}
