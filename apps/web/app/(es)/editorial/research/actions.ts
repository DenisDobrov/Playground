'use server';
import {randomUUID} from 'node:crypto';
import {requireMember} from '../../../../lib/editorial-auth';
import {validateResearchDraft} from '@science/core';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export async function researchCommand(form:FormData) {
 const get=(k:string)=>String(form.get(k)||'');const command=get('command');
 const {client}=await requireMember(!['review','approve'].includes(command));let notice='saved',dossier=get('dossier'),document=get('document');
 try {
  let name:string,args:Record<string,unknown>;
  if(command==='document') {
   const rights={accessBasis:get('accessBasis'),reuseLicense:get('license')||'unknown',licenseUrl:get('licenseUrl'),attribution:get('attribution'),mediaReuse:'not_cleared'};
   args={p_snapshot:get('snapshot'),p_story:get('story'),p_version:get('version'),p_url:get('url'),p_rights:rights};
   const file=form.get('file');
   if(file instanceof File&&file.size) {
    if(file.size>4194304||!file.name.toLowerCase().endsWith('.pdf')||get('text').trim()) throw new Error('Choose PDF or text');
    const {data:{user}}=await client.auth.getUser();const path='research-intake/'+user!.id+'/'+randomUUID()+'.pdf';
    const upload=await client.storage.from('dobrov-academy-assets').upload(path,file,{contentType:'application/pdf',upsert:false});if(upload.error) throw new Error('PDF upload failed');
    name='request_primary_pdf';args={...args,p_object:path};notice='queued';
   } else {name='save_primary_text';args={...args,p_scope:get('scope'),p_text:get('text')};}
  } else if(command==='draft') {
   const {data:doc,error}=await client.from('primary_documents').select('pages,story_id').eq('id',document).single();if(error||!doc) throw new Error('Document required');
   const {data:domains}=await client.from('story_domains').select('domain_id').eq('story_id',doc.story_id);
   const parsed=JSON.parse(get('draft'));const domain=parsed.claims?.[0]?.domainId;
   if(!['ai','physics'].includes(domain)||!domains?.some(d=>d.domain_id===domain)) throw new Error('Invalid domain');
   const draft=validateResearchDraft(parsed,doc.pages,domain);
   name='save_research_dossier';args={p_document:document,p_draft:draft,p_expected:Number(get('expected')),p_command:get('commandId')};
  } else if(command==='review') {
   name='review_scientific_claim';args={p_claim:get('claim'),p_decision:get('decision'),p_reason:get('reason'),p_narrowed:get('decision')==='narrow'?get('narrowed'):null,p_expected:Number(get('expected')),p_effort:Number(get('effort')),p_command:get('commandId')};
  } else if(command==='approve') {
   name='approve_research_dossier';args={p_dossier:dossier,p_hash:get('hash'),p_reviews:JSON.parse(get('reviews')),p_reason:get('reason'),p_command:get('commandId')};
  } else if(command==='brief') {
   name='create_editorial_brief';args={p_dossier:dossier,p_preliminary:get('preliminary')==='true',p_expected_hash:get('hash')};
  } else throw new Error('Unknown command');
  const result=await client.rpc(name,args);
  if(result.error) notice=result.error.code==='40001'?'stale':result.error.message==='Unsupported claim cannot be approved'?'unsupported':'blocked';
  else if(command==='draft') dossier=result.data;else if(command==='document'&&notice!=='queued') document=result.data;
 } catch {notice='blocked';}
 revalidatePath('/editorial/research');
 const params=new URLSearchParams({notice,...(dossier?{dossier}:{}),...(document?{document}:{})});
 redirect('/editorial/research?'+params);
}
