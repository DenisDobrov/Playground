import {canonicalSourceId} from '@science/sources';
export function canonicalNewsIdentity(value:string):string {
 try{return canonicalSourceId(value);}catch{
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('HTTPS identity required');
  if(u.hostname==='www.nature.com'&&/^\/articles\/s[\w-]+$/.test(u.pathname))return canonicalSourceId('10.1038/'+u.pathname.split('/').pop());
  if(u.hostname==='arxiv.org'&&u.pathname.startsWith('/html/'))return canonicalSourceId(u.pathname.slice(6));
  const bio=u.pathname.match(/\/(10\.(?:1101|64898)\/.+?)(?:v\d+)?(?:\.full(?:\.pdf)?)?$/);if(bio)return canonicalSourceId(bio[1]);
  return 'url:'+u.href;
 }
}
export type NewsIdentityCandidate={id:string;slug:string;direct:boolean;first_source:string|null};
/** Shared background citations are not canonical identities. Existing news uses its first/main source. */
export function resolveNewsIdentity(candidates:NewsIdentityCandidate[],primaryIds:string[]){
 const ids=new Set(primaryIds);
 const canonical=candidates.filter(c=>c.direct||!c.first_source||ids.has(canonicalNewsIdentity(c.first_source)));
 if(canonical.length>1)throw Error('CANONICAL_IDENTITY_CONFLICT');
 return {story:canonical[0]??null,contextMatches:candidates.filter(c=>!canonical.includes(c)).map(c=>c.id)};
}
