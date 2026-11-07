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
const standalone=args.includes('--standalone=news-002');
if(!original||!prepared||!instruction||!z.uuid().safeParse(owner).success)throw new Error('Provide source, prepared, instruction and existing owner-id');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Worker credentials required');
const target=new URL(url);const local=target.origin==='http://127.0.0.1:56321';
if(!local&&(target.origin!=='https://upwrplsgunjanragbggb.supabase.co'||!args.includes(standalone?'--production=news-002':'--production=news-001')))throw new Error('Explicit Academy production target required');
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const source=await readFile(original,'utf8'),instructionText=await readFile(instruction,'utf8');
const packages=z.array(newsPackageSchema).length(standalone?1:17).parse(JSON.parse(await readFile(prepared,'utf8')));
if(packages.some(p=>p.campaign))throw new Error('Campaigns require news-campaign-import; batch approval cannot carry over');
if(new Set(packages.map(p=>p.section)).size!==(standalone?1:17)||packages.some(p=>p.provenance.sourceHash!==hash(source)))throw new Error('Source hash/numbering mismatch');
if(standalone){
  if(packages[0].section!==1||!packages[0].period.startsWith('standalone:')||packages[0].en.type!=='analysis'||packages[0].es.type!=='analysis')throw new Error('Standalone analysis contract required');
  if(args.includes('--approve-batch'))throw new Error('Use explicit --release-owner-instruction for the supplied analysis');
}else if(packages.some(p=>p.period!=='2026-11-01/2026-11-07')||args.includes('--release-owner-instruction'))throw new Error('Original weekly issue only');
const client=createClient(url,key,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false}});
const membership=await client.from('editor_members').select('role').eq('user_id',owner).single();
if(membership.error||membership.data.role!=='editor')throw new Error('Existing owner editor membership required');
const existing=await client.from('news_batches').select('id,owner_authorization').eq('source_hash',hash(source)).maybeSingle();
if(existing.error)throw new Error('Batch lookup failed');
const authorization={policy:'news-release/1',origin:'owner_batch_instruction',ownerId:owner,instructionHash:hash(instructionText),scope:standalone?'NEWS-002 supplied standalone analysis and faithful EN/ES/channel adaptations. Explicit owner instruction, not a UI click or scientific review.': 'Original 17-item review, faithful EN/ES translations and channel summaries; checked sources only; no scientific review implied.',...(standalone?{preparedHash:hash(JSON.stringify(packages))}:{})};
if(existing.data&&JSON.stringify(existing.data.owner_authorization)!==JSON.stringify(authorization)){
  // JSONB key ordering is not significant.
  if(existing.data.owner_authorization?.instructionHash!==authorization.instructionHash||existing.data.owner_authorization?.ownerId!==owner||(standalone&&existing.data.owner_authorization?.preparedHash!==authorization.preparedHash))throw new Error('Existing batch authorization differs');
}
// A standalone issue never shares the previous weekly archive's period.
const periodStart=standalone?packages[0].period.slice(11):'2026-11-01',periodEnd=standalone?periodStart:'2026-11-07';
if(standalone){
  const slug=await client.from('news_packages').select('batch_id,event_key').eq('slug',packages[0].slug);
  if(slug.error||slug.data.some(p=>p.batch_id!==existing.data?.id))throw new Error('Standalone slug already belongs to another package');
}
const plans=[];
for(const p of packages){
  // Exact DOI/arXiv matches only, never title/author similarity. Conflicting stories are held.
  const primary=p.sources.find(s=>['doi.org','arxiv.org'].includes(new URL(s.url).hostname))||p.sources[0];
  const identities=[['doi.org','arxiv.org'].includes(new URL(primary.url).hostname)?canonicalSourceId(primary.url):'url:'+new URL(primary.url).href];
  const sources=identities.length?await client.from('sources').select('id').in('canonical_id',identities):{data:[],error:null};
  const aliases=identities.length?await client.from('source_aliases').select('source_id').in('alias',identities):{data:[],error:null};
  if(sources.error||aliases.error)throw new Error('Source identity lookup failed');
  const sourceIds=[...new Set([...(sources.data||[]).map(s=>s.id),...(aliases.data||[]).map(s=>s.source_id)])];
  const matched=sourceIds.length?await client.from('story_sources').select('story_id').in('source_id',sourceIds):{data:[],error:null};
  if(matched.error)throw new Error('Story identity lookup failed');
  const stories=[...new Set((matched.data||[]).map(s=>s.story_id))];
  if(stories.length>1)throw new Error(`EXISTING_IDENTITY_CONFLICT section ${p.section}`);
  let story=stories[0]||null;
  if(story){
    const prior=await client.from('news_packages').select('event_key').eq('story_id',story);
    if(prior.error)throw new Error('Event identity lookup failed');
    if(prior.data.length&&!prior.data.some(e=>e.event_key===p.eventKey)){
      if(standalone)throw new Error('Existing scientific identity has a different news event; reconcile before import');
      story=null;
    }
  }
  plans.push({p,primary,identities,sourceIds,story});
}
if(args.includes('--dry-run')){console.log(JSON.stringify({dryRun:true,packages:packages.length,periodStart,periodEnd,authorizationOrigin:authorization.origin,preparedHash:authorization.preparedHash,sourceHash:hash(source),existingBatch:existing.data?.id??null,identities:plans.map(p=>({section:p.p.section,canonicalIds:p.identities,matchedSources:p.sourceIds.length,matchedStory:p.story}))}));process.exit(0);}
const inserted=existing.data?{data:existing.data,error:null}:await client.from('news_batches').insert({source_text:source,period_start:periodStart,period_end:periodEnd,owner_authorization:authorization}).select('id').single();
if(inserted.error||!inserted.data)throw new Error('Batch save failed');
const batch=inserted.data.id;
for(const {p,primary,identities,sourceIds,story} of plans){
  const imported=await client.rpc('news_import',{p_batch:batch,p_story:story,p_content:p});
  if(imported.error)throw new Error(`News import failed at section ${p.section}: ${imported.error.code}`);
  const pid=imported.data;
  const saved=await client.from('news_packages').select('story_id').eq('id',pid).single();
  if(saved.error)throw new Error('Saved story unavailable');
  // Reuse exact identities; new source metadata remains a source-checked summary, never a scientific approval.
  if(!sourceIds.length){
    const created=await client.from('sources').upsert({canonical_id:identities[0],url:primary.url,title_en:primary.title,kind:primary.kind,metadata:{origin:'news-release/1',access:primary.access,checkedAt:primary.checkedAt,independentScientificVerification:'not_performed'}},{onConflict:'canonical_id',ignoreDuplicates:true});
    if(created.error)throw new Error('Source save failed');
    const source=await client.from('sources').select('id').eq('canonical_id',identities[0]).single();
    if(source.error)throw new Error('Saved source unavailable');sourceIds.push(source.data.id);
  }
  const linked=await client.from('story_sources').upsert(sourceIds.map(id=>({story_id:saved.data.story_id,source_id:id})),{onConflict:'story_id,source_id',ignoreDuplicates:true});
  if(linked.error)throw new Error('Source link failed');
  if((standalone?args.includes('--release-owner-instruction'):args.includes('--approve-batch'))&&p.verification.status==='checked_summary'){
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
