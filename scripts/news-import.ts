/** Trusted operator-only ingestion. Never used as a Server Action or exposed to client JSON. */
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {newsPackageSchema,newsExecutionKind} from '@science/core';
import {canonicalSourceId} from '@science/sources';
const args=process.argv.slice(2);const value=(name:string)=>args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
newsExecutionKind('web_news');
const original=value('--source'),prepared=value('--prepared'),instruction=value('--instruction'),owner=value('--owner-id');
if(!original||!prepared||!instruction||!z.uuid().safeParse(owner).success)throw new Error('Provide source, prepared, instruction and existing owner-id');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Worker credentials required');
const target=new URL(url);const local=target.origin==='http://127.0.0.1:56321';
if(!local&&(target.origin!=='https://upwrplsgunjanragbggb.supabase.co'||!args.includes('--production=news-001')))throw new Error('Explicit Academy production target required');
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const source=await readFile(original,'utf8'),instructionText=await readFile(instruction,'utf8');
const packages=z.array(newsPackageSchema).length(17).parse(JSON.parse(await readFile(prepared,'utf8')));
if(new Set(packages.map(p=>p.section)).size!==17||packages.some(p=>p.provenance.sourceHash!==hash(source)))throw new Error('Source hash/numbering mismatch');
const client=createClient(url,key,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false}});
const membership=await client.from('editor_members').select('role').eq('user_id',owner).single();
if(membership.error||membership.data.role!=='editor')throw new Error('Existing owner editor membership required');
const existing=await client.from('news_batches').select('id,owner_authorization').eq('source_hash',hash(source)).maybeSingle();
if(existing.error)throw new Error('Batch lookup failed');
const authorization={policy:'news-release/1',origin:'owner_batch_instruction',ownerId:owner,instructionHash:hash(instructionText),scope:'Original 17-item review, faithful EN/ES translations and channel summaries; checked sources only; no scientific review implied.'};
if(existing.data&&JSON.stringify(existing.data.owner_authorization)!==JSON.stringify(authorization)){
  // JSONB key ordering is not significant.
  if(existing.data.owner_authorization?.instructionHash!==authorization.instructionHash||existing.data.owner_authorization?.ownerId!==owner)throw new Error('Existing batch authorization differs');
}
const inserted=existing.data?{data:existing.data,error:null}:await client.from('news_batches').insert({source_text:source,period_start:'2026-11-01',period_end:'2026-11-07',owner_authorization:authorization}).select('id').single();
if(inserted.error||!inserted.data)throw new Error('Batch save failed');
const batch=inserted.data.id;
for(const p of packages){
  // Exact DOI/arXiv matches only, never title/author similarity. Conflicting stories are held.
  const identities=p.sources.flatMap(s=>{try{const u=new URL(s.url);return ['doi.org','arxiv.org'].includes(u.hostname)?[canonicalSourceId(s.url)]:[];}catch{return [];}});
  const sources=identities.length?await client.from('sources').select('id').in('canonical_id',identities):{data:[],error:null};
  const aliases=identities.length?await client.from('source_aliases').select('source_id').in('alias',identities):{data:[],error:null};
  if(sources.error||aliases.error)throw new Error('Source identity lookup failed');
  const sourceIds=[...new Set([...(sources.data||[]).map(s=>s.id),...(aliases.data||[]).map(s=>s.source_id)])];
  const matched=sourceIds.length?await client.from('story_sources').select('story_id').in('source_id',sourceIds):{data:[],error:null};
  if(matched.error)throw new Error('Story identity lookup failed');
  const stories=[...new Set((matched.data||[]).map(s=>s.story_id))];
  if(stories.length>1){console.log(JSON.stringify({section:p.section,status:'blocked',reason:'EXISTING_IDENTITY_CONFLICT'}));continue;}
  const imported=await client.rpc('news_import',{p_batch:batch,p_story:stories[0]||null,p_content:p});
  if(imported.error)throw new Error(`News import failed at section ${p.section}: ${imported.error.code}`);
  const pid=imported.data;
  if(args.includes('--approve-batch')&&p.verification.status==='checked_summary'){
    const state=await client.from('news_state').select('version,decision,package_id').eq('package_id',pid).maybeSingle();
    if(state.error)throw new Error('Approval state unavailable');
    if(!state.data){console.log(JSON.stringify({section:p.section,packageId:pid,status:'superseded'}));continue;}
    // Never override a later explicit owner rejection when repeating an initial batch command.
    if(state.data.decision){console.log(JSON.stringify({section:p.section,packageId:pid,status:state.data.decision}));continue;}
    const decision=await client.rpc('news_batch_approve',{p_batch:batch,p_authorization_hash:authorization.instructionHash,p_package:pid,p_expected_version:state.data.version,p_request:randomUUID()});
    if(decision.error)throw new Error(`Batch approval failed at section ${p.section}: ${decision.error.code}`);
  }
  console.log(JSON.stringify({section:p.section,packageId:pid,status:p.verification.status}));
}
