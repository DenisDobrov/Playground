import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedReview, ReviewCandidate } from '@science/sources';
export interface ReviewMatch { identity: string; storyId: string; title: string; status: string }
export interface PreviewItem { candidate:Omit<ReviewCandidate,'rawSection'>; matches:ReviewMatch[]; defaultIdentity:string; duplicateInReview:boolean }
export async function reviewPreview(client:SupabaseClient<any,'academy'>,parsed:ParsedReview) {
  const identities=[...new Set(parsed.candidates.flatMap(c=>c.references.filter(r=>r.role==='primary_candidate').map(r=>r.canonicalId)))];
  if(identities.length>500) throw new Error('Too many publication identities');
  const matches:ReviewMatch[]=[];
  if(identities.length) {
    const results=await Promise.all([
      client.from('sources').select('id,canonical_id').in('canonical_id',identities),
      client.from('source_aliases').select('source_id,alias').in('alias',identities)
    ]);
    if(results.some(r=>r.error)) throw new Error('Publication matching is unavailable');
    const links=[...(results[0].data||[]).map(s=>({identity:s.canonical_id,sourceId:s.id})),...(results[1].data||[]).map(s=>({identity:s.alias,sourceId:s.source_id}))];
    const ids=[...new Set(links.map(l=>l.sourceId))];
    if(ids.length) {
      const {data,error}=await client.from('story_sources').select('source_id,stories(id,title_en,status)').in('source_id',ids).overrideTypes<{source_id:string;stories:{id:string;title_en:string;status:string}|null}[],{merge:false}>();
      if(error) throw new Error('Story matching is unavailable');
      for(const link of links) for(const item of data||[]) if(item.source_id===link.sourceId && item.stories) matches.push({identity:link.identity,storyId:item.stories.id,title:item.stories.title_en,status:item.stories.status});
    }
  }
  const seen=new Set<string>();
  const items:PreviewItem[]=parsed.candidates.map(candidate=>{
    const identities=[...new Set(candidate.references.filter(r=>r.role==='primary_candidate').map(r=>r.canonicalId))];
    const found=[...new Map(matches.filter(m=>identities.includes(m.identity)).map(m=>[m.identity+':'+m.storyId,m])).values()];
    const defaultIdentity=new Set(found.map(m=>m.storyId)).size===1 ? found[0].identity : found.length ? '' : identities.length===1 ? identities[0] : '';
    const duplicateInReview=identities.some(id=>seen.has(id));identities.forEach(id=>seen.add(id));
    const {rawSection,...previewCandidate}=candidate;
    return {candidate:previewCandidate,matches:found,defaultIdentity,duplicateInReview};
  });
  return {items,total:items.length,newCandidates:items.filter(i=>!i.matches.length && i.candidate.domain && i.candidate.references.some(r=>r.role==='primary_candidate')).length,
    matches:items.filter(i=>i.matches.length).length,potentialDuplicates:items.filter(i=>i.matches.length || i.duplicateInReview).length,
    unsupported:items.filter(i=>!i.candidate.domain).length,missingPrimary:items.filter(i=>i.candidate.flags.includes('missing_primary_source')).length,
    manual:items.filter(i=>i.candidate.flags.length || new Set(i.matches.map(m=>m.storyId)).size>1).length};
}
