import { createHash } from 'node:crypto';
import { canonicalSourceId } from './index';
export const REVIEW_PARSER = 'external-review/1';
export const REVIEW_MAX_BYTES = 256 * 1024;
export const reviewHash = (value: string) => createHash('sha256').update(value).digest('hex');
export interface ReviewReference {
  url: string; canonicalId: string; revision: number | null;
  role: 'primary_candidate' | 'secondary' | 'unknown';
}
export type ScientificEventKind = 'initial_preprint' | 'preprint_revision' | 'journal_publication' | 'experimental_result' | 'independent_replication' | 'correction' | 'retraction' | 'scientific_announcement';
export interface ReportedEvent { kind: ScientificEventKind; reportedDate: string | null; date: string | null; revision: number | null; referenceIdentity?:string }
export interface ReviewCandidate {
  key: string; title: string; category: string; domain: 'ai' | 'physics' | null;
  startLine: number; endLine: number; rawSection: string;
  summary: string | null; significance: string | null; limitations: string | null; priority: string | null; questions: string | null;
  references: ReviewReference[]; events: ReportedEvent[]; flags: string[]; verification: 'unverified';
}
export interface ParsedReview { hash: string; documentHash:string; parserVersion: string; candidates: ReviewCandidate[]; warnings: string[] }
function trimLink(value: string) {
  let result = value.replace(/[.,;]+$/g, '');
  while (result.endsWith(')') && (result.match(/\)/g)?.length || 0) > (result.match(/\(/g)?.length || 0)) result = result.slice(0,-1);
  return result;
}
export function reviewReference(input: string): ReviewReference | null {
  let text=trimLink(input.trim());
  let url: URL;
  try {
    if (/^(?:doi:)?10\.\d{4,9}\//i.test(text)) text='https://doi.org/'+text.replace(/^doi:/i,'');
    if (/^arxiv:/i.test(text)) text='https://arxiv.org/abs/'+text.slice(6);
    url=new URL(text);
  } catch { return null; }
  if(url.protocol==='http:' && /^(?:www\.)?arxiv\.org$|^(?:dx\.)?doi\.org$/.test(url.hostname)) url.protocol='https:';
  if(url.protocol!=='https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || /\.(?:local|internal)$/.test(url.hostname) || url.hostname.includes(':')) return null;
  url.hash='';
  for(const key of [...url.searchParams.keys()]) if(/^utm_|^(?:fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  url.pathname=url.pathname.replace(/\/$/,'');
  let canonicalId: string | null=null;
  let revision: number | null=null;
  const arxiv=url.hostname==='arxiv.org' || url.hostname==='www.arxiv.org';
  let decoded=url.pathname;try {decoded=decodeURIComponent(decoded);} catch { /* Malformed encoding remains an unresolved URL. */ }
  const doiPath=decoded.match(/10\.\d{4,9}\/[^\s]+/i)?.[0];
  try {
    if(arxiv) {
      canonicalId=canonicalSourceId(url.origin+url.pathname); revision=Number(url.pathname.match(/v(\d+)(?:\.pdf)?$/i)?.[1]) || null;
    } else if(doiPath) {
      let doi=doiPath;
      if(/(?:^|\.)(?:biorxiv|medrxiv)\.org$/.test(url.hostname)) {
        doi=doi.replace(/\.(?:full|abstract|long)(?:\.pdf)?$/i,'');
        revision=Number(doi.match(/v(\d+)$/i)?.[1]) || null;
        doi=doi.replace(/v\d+$/i,'');
      }
      canonicalId=canonicalSourceId(doi);
    } else if(url.hostname==='www.nature.com' && /^\/articles\/s[\w-]+$/.test(url.pathname)) canonicalId=canonicalSourceId('10.1038/'+url.pathname.split('/').pop());
  } catch { /* Preserve a URL even when the DOI/arXiv syntax is unsupported. */ }
  // An identifier is only a bibliographic hint, never proof that the page supports a claim.
  const publicationHost=/^(?:(?:www|journals)\.)?(?:doi\.org|dx\.doi\.org|nature\.com|science\.org|aps\.org|arxiv\.org|biorxiv\.org|medrxiv\.org)$/.test(url.hostname);
  return {url:url.href,canonicalId:canonicalId || 'url:'+url.href,revision,role:canonicalId && publicationHost ? 'primary_candidate' : /\/subjects\/|\/news\/|phys\.org|reuters\.com|physics\.aps\.org/.test(url.href) ? 'secondary' : 'unknown'};
}
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function dateValue(text: string): string | null {
  const iso=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const words=text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  const value=iso ? [Number(iso[1]),Number(iso[2]),Number(iso[3])] : words ? [Number(words[3]),months.indexOf(words[2].toLowerCase())+1,Number(words[1])] : null;
  if(!value || value[0]<1) return null;
  const [year,month,day]=value;
  const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);
  return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
}
function category(title: string): {category:string;domain:ReviewCandidate['domain']} {
  if(/medical|diagnos|clinical|medicine/i.test(title)) return {category:'medicine',domain:null};
  if(/\bAI\b|artificial intelligence|machine learning/i.test(title)) return {category:'artificial_intelligence',domain:'ai'};
  if(/neuro|brain|astrocyte/i.test(title)) return {category:'neuroscience',domain:null};
  if(/longevity|ageing|aging|senescen/i.test(title)) return {category:'longevity',domain:null};
  if(/origin.of.life/i.test(title)) return {category:'origin_of_life',domain:null};
  if(/biotech/i.test(title)) return {category:'biotechnology',domain:null};
  if(/quantum comput|qubit|quantum error/i.test(title)) return {category:'quantum_computing',domain:'physics'};
  if(/astrophys|cosmolog|astronom|\bspace\b/i.test(title)) return {category:'astrophysics_cosmology',domain:'physics'};
  if(/physics|antimatter|positron/i.test(title)) return {category:'fundamental_physics',domain:'physics'};
  return {category:'other',domain:null};
}
function sectionField(raw: string, names: string): string | null {
  const pattern=new RegExp(`^#{2,5}\\s+(?:${names})\\s*\\r?\\n([\\s\\S]*?)(?=^#{1,5}\\s|$(?![\\s\\S]))`,'im');
  return raw.match(pattern)?.[1].trim() || null;
}
export function parseExternalReview(markdown: string): ParsedReview {
  if(!markdown.trim() || Buffer.byteLength(markdown,'utf8')>REVIEW_MAX_BYTES || markdown.includes('\0')) throw new Error('Provide non-empty Markdown up to 256 KiB');
  const normalized=markdown.replace(/\r\n?/g,'\n');
  const definitions=new Map([...normalized.matchAll(/^\s*\[([^\]]+)\]:\s*(https:\/\/\S+)/gm)].map(m=>[m[1].toLowerCase(),m[2]]));
  const headings=[...normalized.matchAll(/^(#{1,3})\s+(?:\d+[.)]\s+|Story:\s*)(.+)$/gim)];
  const level=headings.length ? Math.min(...headings.map(h=>h[1].length)) : 0;
  const starts=headings.filter(h=>h[1].length===level);
  if(starts.length>50) throw new Error('At most 50 candidate sections per review');
  const candidates: ReviewCandidate[]=[];
  const ranges=starts.length ? starts.map(h=>({index:h.index!,title:h[2]})) : [{index:0,title:normalized.match(/^#\s+(.+)$/m)?.[1] || 'Unparsed section'}];
  for(let i=0;i<ranges.length;i++) {
    const start=ranges[i].index;
    // End at any sibling/ancestor heading: do not absorb executive conclusions or the bibliography.
    const bodyStart=normalized.indexOf('\n',start);
    const following=bodyStart>=0 ? [...normalized.slice(bodyStart+1).matchAll(new RegExp(`^#{1,${level || 1}}\\s+(.+)$`,'gm'))]
      .find(h=>! /^(?:Summary|What changed|What is new|Scientific significance|Why it matters|Limitations|Hype check|Caveats|Open questions|Outstanding questions|What next|Worth reading)\s*$/i.test(h[1])) : null;
    const end=starts.length && following ? bodyStart+1+following.index! : normalized.length;
    const raw=normalized.slice(start,end).trimEnd();
    const urls=[...raw.matchAll(/https?:\/\/[^\s<>"\]]+/gi)].map(m=>m[0]);
    for(const match of raw.matchAll(/\[[^\]\n]*\]\[([^\]]+)\]/g)) {const found=definitions.get(match[1].toLowerCase());if(found) urls.push(found);}
    const prose=raw.replace(/https?:\/\/[^\s<>"\]]+/gi,'');
    for(const match of prose.matchAll(/(?:\bdoi:\s*)?\b(10\.\d{4,9}\/\S+)|\barxiv:\s*((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?)/gi)) urls.push(match[1] ? 'doi:'+match[1] : 'arxiv:'+match[2]);
    const references=[...new Map(urls.map(reviewReference).filter((r):r is ReviewReference=>!!r).map(r=>[`${r.canonicalId}:${r.revision}:${r.url}`,r])).values()];
    if(references.length>100) throw new Error('At most 100 references per section');
    const title=ranges[i].title.replace(/\*\*/g,'').trim().slice(0,500);
    const scope=category(title);
    const flags:string[]=[];
    if(!starts.length) flags.push('unparsed_section');
    if(!scope.domain) flags.push('future_scope');
    const primary=references.filter(r=>r.role==='primary_candidate');
    if(!primary.length) flags.push('missing_primary_source');
    if(new Set(primary.map(r=>r.canonicalId)).size>1) flags.push('multiple_publications_choose_identity');
    const events:ReportedEvent[]=[];
    const journal=raw.match(/^\*{0,2}Journal:\*{0,2}\s*(.+)/im)?.[1];
    for(const m of raw.matchAll(/^\*{0,2}(Published|Announced|Research paper):\*{0,2}\s*([^\n]+)/gim)) {
      const reportedDate=m[2].replace(/\*\*/g,'').trim();
      events.push({kind:m[1].toLowerCase()==='announced' ? 'scientific_announcement' : /preprint/i.test(reportedDate) ? 'initial_preprint' : journal ? 'journal_publication' : 'scientific_announcement',reportedDate,date:dateValue(reportedDate),revision:null});
    }
    const explicit=[...raw.matchAll(/^\*{0,2}Event:\*{0,2}\s*(initial_preprint|preprint_revision|journal_publication|experimental_result|independent_replication|correction|retraction|scientific_announcement)\b/gim)];
    if(explicit.length) for(const observation of explicit) events.push({kind:observation[1].toLowerCase() as ScientificEventKind,reportedDate:null,date:null,revision:null});
    else {
      const named=title.match(/\b(retraction|correction|independent replication|new experimental results)\b/i)?.[1].toLowerCase();
      if(named) events.push({kind:named==='independent replication' ? 'independent_replication' : named==='new experimental results' ? 'experimental_result' : named as ScientificEventKind,reportedDate:null,date:null,revision:null});
    }
    for(const r of primary) if(r.revision) events.push({kind:r.revision>1 ? 'preprint_revision' : 'initial_preprint',reportedDate:null,date:null,revision:r.revision,referenceIdentity:r.canonicalId});
    const older=raw.match(/(?:first appeared as a preprint in|preprint (?:first )?(?:posted|published) (?:on|in))\s+([^.;\n]+)/i);
    if(older) events.push({kind:'initial_preprint',reportedDate:older[1].trim(),date:dateValue(older[1]),revision:null});
    if(events.some(e=>e.reportedDate && !e.date)) flags.push('date_requires_review');
    const summary=sectionField(raw,'Summary|What changed|What is new');
    const limitations=sectionField(raw,'Limitations|Hype check|Caveats');
    if(!summary || !limitations) flags.push('incomplete_fields');
    candidates.push({key:`section-${i+1}`,title,...scope,startLine:normalized.slice(0,start).split('\n').length,endLine:normalized.slice(0,end).split('\n').length,
      rawSection:raw,summary,significance:sectionField(raw,'Scientific significance|Why it matters'),limitations,
      priority:raw.match(/\*\*(?:Assessment|Priority|Suggested editorial priority):\s*([^\n]+?)\*\*/i)?.[1] || null,
      questions:sectionField(raw,'Open questions|Outstanding questions|What next'),references,events,flags,verification:'unverified'});
  }
  return {hash:reviewHash(markdown),documentHash:reviewHash(normalized),parserVersion:REVIEW_PARSER,candidates,warnings:starts.length ? [] : ['No supported numbered story headings; original retained for manual review']};
}
