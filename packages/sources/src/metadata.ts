import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
import {canonicalSourceId} from './index';
import {boundedMetadataRequest} from './fetch';
export const METADATA_ADAPTER = 'primary-metadata/1';
export interface PrimaryMetadata {
  identity:string; provider:'arxiv'|'crossref'; title:string; authors:string[]; abstract:string|null;
  categories:string[]; dates:Record<string,unknown>; version:number|null; doi:string|null;
  journal:string|null; publication:Record<string,unknown>; relations:Record<string,unknown>; updates:unknown[];
  bibliographicStatus:'metadata_confirmed'; scientificStatus:'unverified';
}
const list=<T>(v:T|T[]|undefined):T[]=>v===undefined?[]:Array.isArray(v)?v:[v];
const text=(v:unknown)=>typeof v==='string'?v.replace(/\s+/g,' ').trim():'';
const iso=(v:unknown)=>/^\d{4}-\d{2}-\d{2}T/.test(text(v)) && Number.isFinite(Date.parse(text(v)))?new Date(text(v)).toISOString():null;
export const metadataHash=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
function boundedRecord(m:PrimaryMetadata):PrimaryMetadata {
  if(m.title.length>2000||m.authors.length>500||m.categories.length>500||Buffer.byteLength(JSON.stringify(m))>262144) throw new Error('Normalized metadata exceeds limits');
  if(m.doi&&!m.doi.startsWith('doi:')) throw new Error('Invalid DOI metadata');
  return m;
}
export function metadataEndpoint(input:string) {
  const identity=canonicalSourceId(input);
  if(identity.length>500) throw new Error('Identifier too long');
  return {identity,provider:identity.startsWith('arxiv:')?'arxiv' as const:'crossref' as const,
    url:identity.startsWith('arxiv:')?'https://export.arxiv.org/api/query?id_list='+encodeURIComponent(identity.slice(6))+'&max_results=1':'https://api.crossref.org/works/'+encodeURIComponent(identity.slice(4))};
}
export function parsePrimaryMetadata(input:string,raw:string):PrimaryMetadata {
  const {identity,provider}=metadataEndpoint(input);
  if(Buffer.byteLength(raw)>2_000_000) throw new Error('Metadata too large');
  const base={identity,provider,bibliographicStatus:'metadata_confirmed' as const,scientificStatus:'unverified' as const};
  if(provider==='arxiv') {
    if(/<!\s*(DOCTYPE|ENTITY)/i.test(raw)||XMLValidator.validate(raw)!==true) throw new Error('Unsafe XML');
    const doc=new XMLParser({ignoreAttributes:false,parseTagValue:false,processEntities:false}).parse(raw);
    const entries=list<Record<string,any>>(doc.feed?.entry);
    if(entries.length!==1) throw new Error('Expected one arXiv result');
    const e=entries[0];
    if(!/^https?:\/\/arxiv.org\/abs\//.test(text(e.id))||canonicalSourceId(text(e.id))!==identity) throw new Error('arXiv identity mismatch');
    const title=text(e.title);const authors=list<Record<string,unknown>>(e.author).map(a=>text(a.name)).filter(Boolean);
    if(!title||!authors.length||!iso(e.published)||!iso(e.updated)) throw new Error('Incomplete arXiv metadata');
    const doi=text(e['arxiv:doi']);
    return boundedRecord({...base,title,authors,abstract:text(e.summary)||null,categories:list<Record<string,string>>(e.category).map(c=>c['@_term']).filter(Boolean),
      dates:{initialPublished:iso(e.published),updated:iso(e.updated)},version:Number(text(e.id).match(/v(\d+)$/)?.[1])||null,
      doi:doi?canonicalSourceId(doi):null,journal:text(e['arxiv:journal_ref'])||null,publication:{},relations:{},updates:[]});
  }
  const doc=JSON.parse(raw);const e=doc.message;
  if(doc.status!=='ok'||doc['message-type']!=='work'||!e||canonicalSourceId(text(e.DOI))!==identity) throw new Error('Crossref identity mismatch');
  const title=list<unknown>(e.title).map(text).filter(Boolean).join('; ');
  if(!title) throw new Error('Missing publication title');
  const dates:Record<string,unknown>={};
  // Preserve partial date-parts as provided; never substitute created/indexed for publication.
  for(const k of ['published','published-online','published-print','issued','created','indexed','deposited']) if(e[k]!==undefined) dates[k]=e[k];
  const publication:Record<string,unknown>={};
  for(const k of ['type','publisher','volume','issue','page','article-number','ISSN','ISBN']) if(e[k]!==undefined) publication[k]=e[k];
  return boundedRecord({...base,title,authors:list<Record<string,unknown>>(e.author).map(a=>text(a.name)||[text(a.given),text(a.family)].filter(Boolean).join(' ')).filter(Boolean),
    abstract:text(e.abstract)||null,categories:list<unknown>(e.subject).map(text).filter(Boolean),dates,version:null,doi:identity,
    journal:list<unknown>(e['container-title']).map(text).filter(Boolean).join('; ')||null,
    publication,relations:e.relation && typeof e.relation==='object' && !Array.isArray(e.relation)?e.relation:{},updates:list(e['update-to'])});
}
export async function fetchPrimaryMetadata(input:string) {
  const target=metadataEndpoint(input);
  return {...await boundedMetadataRequest(target.url,target.provider==='arxiv'?'xml':'json'),...target};
}
/** Explicit primary-service relationship only; similarity is never sufficient. */
export function relationshipEvidence(arxiv:PrimaryMetadata,crossref:PrimaryMetadata):{eligible:boolean;warnings:string[]} {
  const explicit=arxiv.provider==='arxiv' && crossref.provider==='crossref' && arxiv.doi===crossref.identity;
  const words=(s:string)=>new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
  const a=words(arxiv.title),b=words(crossref.title);
  const overlap=[...a].filter(w=>b.has(w)).length/Math.max(1,Math.min(a.size,b.size));
  const surname=(s:string)=>s.trim().toLowerCase().split(/\s+/).at(-1);
  const authorMatch=arxiv.authors.some(a=>crossref.authors.some(b=>surname(a)===surname(b)));
  const warnings:string[]=[];
  if(!explicit) warnings.push('no_explicit_primary_relationship');
  if(overlap<0.5) warnings.push('title_disagreement');
  if(!authorMatch) warnings.push('authors_disagree_or_missing');
  return {eligible:explicit&&warnings.length===0,warnings};
}
