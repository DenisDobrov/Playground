import 'server-only';
import type {KnowledgeRecord,KnowledgeSearch,KnowledgeDecision,KnowledgeSuggestion,knowledgeQuery,NewsPackage} from '@science/core';
import type {requireMember} from './editorial-auth';

type Client=Awaited<ReturnType<typeof requireMember>>['client'];
type Target={id:string;story_id:string;version:number;content:NewsPackage};
export class KnowledgeUnavailable extends Error {
 constructor(public readonly missingMigration:boolean){super('Knowledge Base unavailable');}
}
function checked<T>(result:{data:T|null;error:{code?:string}|null}):T {
 if(result.error)throw new KnowledgeUnavailable(['PGRST202','PGRST205','42P01','42883'].includes(result.error.code??''));
 return result.data as T;
}
const recordColumns='entry_key,kind,title,summary,story_id,package_id,created_at,is_current,payload,record_hash';
export async function loadKnowledge(client:Client,params:ReturnType<typeof knowledgeQuery>){
 const search=checked(await client.rpc('knowledge_search',{p_query:params.q,p_kind:params.kind,p_page:params.page,p_history:params.history})) as KnowledgeSearch;
 const entry=params.entry?checked(await client.from('knowledge_records').select(recordColumns).eq('entry_key',params.entry).maybeSingle()) as KnowledgeRecord|null:search.items[0]??null;
 const history=entry?checked(await client.from('knowledge_context_decisions').select('*').eq('entry_key',entry.entry_key).order('sequence',{ascending:false}).limit(21)) as KnowledgeDecision[]:[];
 let targets:{package_id:string;title:string;revision:string}[]=[];
 let target:Target|null=null;
 let suggestions:KnowledgeSuggestion[]=[];
 let decisions:KnowledgeDecision[]=[];
 let linked:KnowledgeDecision[]=[];
 let linkedRecords:KnowledgeRecord[]=[];
 if(params.mode==='context'){
   targets=checked(await client.rpc('knowledge_targets',{p_query:params.target})) as typeof targets;
   if(params.package){
     const state=checked(await client.from('news_state').select('package_id').eq('package_id',params.package).maybeSingle());
     if(state){
       target=checked(await client.from('news_packages').select('id,story_id,version,content').eq('id',params.package).single()) as Target;
       suggestions=checked(await client.rpc('knowledge_suggestions',{p_package:params.package})) as KnowledgeSuggestion[];
       linked=checked(await client.rpc('knowledge_context_latest',{p_package:params.package})) as KnowledgeDecision[];
       if(linked.length)linkedRecords=checked(await client.from('knowledge_records').select(recordColumns).in('entry_key',linked.map(d=>d.entry_key))) as KnowledgeRecord[];
       if(entry)decisions=checked(await client.from('knowledge_context_decisions').select('*').eq('package_id',params.package).eq('entry_key',entry.entry_key).order('sequence',{ascending:false}).limit(21)) as KnowledgeDecision[];
     }
   }
 }
 const reason=target&&entry?checked(await client.rpc('knowledge_context_reason',{p_package:target.id,p_entry:entry.entry_key})) as string|null:null;
 // Material versions stay browsable without overwriting a previously published snapshot.
 const versions=entry?.story_id?checked(await client.from('knowledge_records').select(recordColumns).eq('story_id',entry.story_id).eq('kind','material').order('created_at',{ascending:false}).limit(21)) as KnowledgeRecord[]:[];
 const related=entry?.payload.related?.length?checked(await client.from('knowledge_records').select(recordColumns).in('entry_key',entry.payload.related.slice(0,12))) as KnowledgeRecord[]:[];
 return {search,entry,history,targets,target,suggestions,decisions,reason,versions,related,linked,linkedRecords};
}
