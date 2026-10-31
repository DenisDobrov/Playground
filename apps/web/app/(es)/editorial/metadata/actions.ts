'use server';
import {requireMember} from '../../../../lib/editorial-auth';
import {canonicalSourceId} from '@science/sources';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
export async function metadataCommand(form:FormData) {
  const {client}=await requireMember(true);
  const get=(key:string)=>String(form.get(key)||'');
  const back=get('back');const path=back.startsWith('/editorial/metadata?')?back:'/editorial/metadata';
  let notice='saved';
  try {
    const command=get('command');let name:string;let args:Record<string,unknown>;
    if(command==='fetch') {name='request_metadata';args={p_identity:canonicalSourceId(get('identity'))};notice='queued';}
    else if(command==='propose') {name='propose_identity';args={p_arxiv:get('arxiv'),p_doi:get('doi')};}
    else if(command==='link') {name='confirm_identity';args={p_proposal:get('proposal'),p_reason:get('reason'),p_command:get('commandId')};}
    else if(command==='resolve') {name='resolve_pending';args={p_item:get('item'),p_snapshot:get('snapshot'),p_expected:Number(get('expected')),p_reason:get('reason'),p_command:get('commandId')};}
    else if(command==='reconcile') {name='reconcile_events';args={p_observations:form.getAll('observation').map(String),p_snapshot:get('snapshot'),p_kind:get('kind'),p_basis:get('basis'),p_expected:JSON.parse(get('expected')),p_reason:get('reason'),p_command:get('commandId')};}
    else throw new Error('Unknown command');
    const {data,error}=await client.rpc(name,args);
    if(error) {notice=error.code==='40001'?'stale':'held';} else if(data?.outcome==='conflict') notice='conflict';
  } catch {notice='held';}
  revalidatePath('/editorial/metadata');revalidatePath('/editorial/imports');revalidatePath('/editorial/stories');
  redirect(path+(path.includes('?')?'&':'?')+'notice='+notice);
}
