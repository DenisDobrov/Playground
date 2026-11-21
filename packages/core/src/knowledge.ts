import {z} from 'zod';

export const knowledgeKinds=['topic','source','claim','decision','material'] as const;
export type KnowledgeKind=typeof knowledgeKinds[number];
export interface KnowledgeSource {title?:string;url?:string|null;quote?:string|null;locator?:string|null;limitations?:string|null;finding?:string;studyDate?:string|null;announcementDate?:string|null;checkedAt?:string;access?:string;}
export interface KnowledgeRecord {
 entry_key:string;kind:KnowledgeKind;title:string;summary:string;story_id:string|null;package_id:string|null;
 created_at:string|null;is_current:boolean;record_hash:string;
 payload:{origin:string;status:string;revision?:string;independentVerification?:string|null;limitations?:string|null;
   fields?:Record<string,string|null>;sources?:KnowledgeSource[];related?:string[];ownerComment?:string;
   publications?:{language:string;slug:string;publishedAt:string}[];};
}
export interface KnowledgeSearch {items:KnowledgeRecord[];total:number;page:number;pages:number;}
export interface KnowledgeDecision {
 id:string;sequence:number;package_id:string;package_hash:string;entry_key:string;record_hash:string;entry_snapshot:KnowledgeRecord;
 actor_id:string;decision:'accept'|'reject';comment:string;rationale:string;algorithm:string;previous_id:string|null;created_at:string;
}
export interface KnowledgeSuggestion {entry_key:string;kind:KnowledgeKind;title:string;record_hash:string;reason:string;}
export const knowledgeDecisionInput=z.object({
 package:z.uuid(),entry:z.string().min(3).max(700),hash:z.string().regex(/^[a-f0-9]{64}$/),
 previous:z.uuid().nullable(),request:z.uuid(),decision:z.enum(['accept','reject']),comment:z.string().max(4000)
});
const uuid=z.uuid();
export function knowledgeQuery(params:Record<string,string|string[]|undefined>){
 const single=(k:string)=>typeof params[k]==='string'?params[k] as string:'';
 const page=Number(single('page'));
 return {q:single('q').trim().slice(0,200),kind:knowledgeKinds.includes(single('kind') as KnowledgeKind)?single('kind'):'all',
   page:Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1,history:single('history')==='1',
   entry:single('entry').slice(0,700),mode:single('mode')==='context'?'context':'library',
   package:uuid.safeParse(single('package')).success?single('package'):'',target:single('target').trim().slice(0,200)};
}
export function knowledgeUrl(values:Partial<ReturnType<typeof knowledgeQuery>>={}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(values))if(value!==undefined&&value!==''&&value!==false&&!(key==='page'&&value===1))params.set(key,value===true?'1':String(value));
 return '/editorial/knowledge'+(params.size?'?'+params:'');
}
/** Linking is user navigation only, never server fetching. Do not render active untrusted schemes. */
export function knowledgeSourceUrl(value:unknown){
 if(typeof value!=='string')return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function contextDecisionState(decision:KnowledgeDecision,entry:KnowledgeRecord|null,currentPackage:string){
 if(decision.package_id!==currentPackage||!entry||!entry.is_current||decision.record_hash!==entry.record_hash)return 'stale';
 return decision.decision;
}
