import {createHmac} from 'node:crypto';
import {parseExternalReview,reviewHash} from './reviews';
export interface ReviewSelection {key:string;identity:string|null;reopen?:boolean}
/** Trusted server boundary: accept choices, never client-provided extraction. */
export function prepareReviewImport(markdown:string,sourceType:'chatgpt'|'external_review',actor:string,selection:ReviewSelection[],key:string) {
  if(!/^[a-f0-9]{64}$/i.test(key) || !/^[a-f0-9-]{36}$/i.test(actor)) throw new Error('Review signing configuration is unavailable');
  const parsed=parseExternalReview(markdown);
  if(!selection.length || selection.length>50 || new Set(selection.map(s=>s.key)).size!==selection.length) throw new Error('Select valid sections');
  const items=selection.map(choice=>{
    const extraction=parsed.candidates.find(c=>c.key===choice.key);
    if(!extraction || (choice.identity && !extraction.references.some(r=>r.role==='primary_candidate' && r.canonicalId===choice.identity))) throw new Error('Invalid review selection');
    return {key:extraction.key,identity:choice.identity||null,reopen:choice.reopen===true,extraction};
  });
  const text=JSON.stringify(items);
  const message=['review-import/1',actor.toLowerCase(),parsed.parserVersion,sourceType,parsed.hash,reviewHash(text)].join('\n');
  const signature=createHmac('sha256',Buffer.from(key,'hex')).update(message).digest('hex');
  return {p_markdown:markdown,p_source_type:sourceType,p_parser_version:parsed.parserVersion,p_items:text,p_attestation:signature};
}
