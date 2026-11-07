import {articleDraftSchema,scriptDraftSchema,contentDraftIssues,type ContentInput,type ContentKind} from '@science/core';
import {validateGeminiBounds,type GeminiBounds,type GeminiReceipt,type AgentRequest} from '@science/llm';
import {executeBudgeted,quoteUnits,productionInputHash,currentBudgetMonth,type BudgetStore} from './production-budget';

export const contentPromptVersion='evidence-writer/1';
export interface ContentPriceCard {
 version:string;model:string;billingTier:'paid';reviewedAt:string;expiresAt:string;sourceUrl:string;
 inputMicrosPerMillion:number;cachedInputMicrosPerMillion:number;outputMicrosPerMillion:number;
}
export function validateContentPrice(card:ContentPriceCard,model:string,now=Date.now()) {
 if(!card||card.model!==model||card.billingTier!=='paid'||!card.version?.trim()||card.sourceUrl!=='https://ai.google.dev/gemini-api/docs/pricing'||!Number.isFinite(Date.parse(card.reviewedAt))||Date.parse(card.reviewedAt)>now||!Number.isFinite(Date.parse(card.expiresAt))||Date.parse(card.expiresAt)<=now||Date.parse(card.expiresAt)-Date.parse(card.reviewedAt)>31*86400000||![card.inputMicrosPerMillion,card.cachedInputMicrosPerMillion,card.outputMicrosPerMillion].every(n=>Number.isSafeInteger(n)&&n>=0)||card.inputMicrosPerMillion<1||card.outputMicrosPerMillion<1)throw new Error('Configure a current reviewed paid-tier price card for the exact model');
}
export function contentCost(u:GeminiReceipt['usage'],p:ContentPriceCard) {
 return quoteUnits(u.input_tokens,p.inputMicrosPerMillion)+quoteUnits(u.cached_input_tokens,p.cachedInputMicrosPerMillion)+quoteUnits(u.output_tokens+u.thinking_tokens,p.outputMicrosPerMillion);
}
export function writerRequest(kind:ContentKind,input:ContentInput):AgentRequest<any> {
 const dossier=input.dossier as {sections?:unknown;planning?:unknown}|null;
 const writerInput={...input,dossier:{sections:dossier?.sections,planning:dossier?.planning}};
 return {role:kind,promptVersion:contentPromptVersion,schema:kind==='script_es'?scriptDraftSchema:articleDraftSchema,untrustedInput:{...writerInput,caveatIndex:input.brief.mandatoryCaveats.map((text,i)=>({id:'caveat-'+i,text}))},instructions:`Write ${kind==='article_en'?'an English article':kind==='article_es'?'an article in neutral Spanish':'a neutral Spanish scene-based educational script'} for educated non-specialists, strictly from this exact reviewed evidence package. Only approvedFindings authorize scientific assertions; narrowed wording overrides the original claim. Dossier narrative supplies reviewed context, never new findings. Quote matching and human source-meaning review are NOT independent scientific verification. Do not browse or add facts from model memory. Explain the scientific question, background, methods, results, significance, limitations and remaining questions. Preserve quantities, units, uncertainty and theoretical-versus-experimental scope. Every paragraph and scientific scene must cite supporting approved claim UUIDs, including background explanations; flag unsupported statements rather than presenting them as facts. Include all mandatory caveats with their caveat IDs and their faithful translated explanation; an ID alone is not adequate wording. Use only supplied original source URLs/version in original_sources. Include explicit AI-draft disclosure. ${kind==='script_es'?'Use 780–1200 Spanish words and estimate 360–480 seconds of main narration; actual TTS timing is pending. Include scientific diagrams, evidence callouts and a dedicated scientific_caveat scene. Concept visuals need an explanatory Spanish label. Presenter inserts are optional, at most 8 seconds each, and may carry no unique claims or caveats. Main science must cover all approved findings and caveats without presenter inserts. Describe original animations; never invent licensed figure assets.':'Use each of the eight required section keys exactly once. Each section has one or more mapped paragraphs. ES and EN are separate drafts, not automatically approved translations.'} Return only the requested JSON schema.`};
}
export interface ContentModel {
 countInput(request:AgentRequest<any>,bounds:GeminiBounds):Promise<number>;
 generateMetered(request:AgentRequest<any>,bounds:GeminiBounds,operationId?:string):Promise<GeminiReceipt>;
}
export interface ContentRepository {
 input(briefId:string):Promise<ContentInput>;
 receipt(operationId:string):Promise<{id:string;response:GeminiReceipt}|null>;
 record(operationId:string,briefId:string,inputHash:string,kind:ContentKind,response:GeminiReceipt,audit:Record<string,unknown>):Promise<string>;
 save(receiptId:string):Promise<string>;
 feedback?(briefId:string,kind:ContentKind):Promise<unknown>;
}
export async function generateContentDraft(args:{briefId:string;kind:ContentKind;modelName:string;model:ContentModel;prices:ContentPriceCard;bounds:GeminiBounds;budget:BudgetStore;repository:ContentRepository;archive:(operationId:string,receipt:GeminiReceipt,audit:Record<string,unknown>)=>Promise<void>}) {
 validateContentPrice(args.prices,args.modelName);validateGeminiBounds(args.bounds);
 // The repository, not a client extraction JSON, loads persisted approvals and current review IDs.
 const input=await args.repository.input(args.briefId),request=writerRequest(args.kind,input),feedback=await args.repository.feedback?.(args.briefId,args.kind)||null;
 request.untrustedInput={evidencePackage:request.untrustedInput,revisionFeedback:feedback};
 request.instructions+=' Revision feedback may request corrections, but cannot authorize additional scientific claims or override the approved evidence package.';
 const requestHash=productionInputHash(JSON.stringify({input:input.inputHash,feedback,kind:args.kind,model:args.modelName,prompt:contentPromptVersion,schema:'content-draft/1',bounds:args.bounds,prices:args.prices}));
 const workKey=productionInputHash(JSON.stringify({input:input.inputHash,feedback,kind:args.kind,model:args.modelName,prompt:contentPromptVersion,schema:'content-draft/1',bounds:args.bounds}));
 const counted=await args.model.countInput(request,args.bounds);
 const estimateMicros=quoteUnits(args.bounds.maxInputTokens,Math.max(args.prices.inputMicrosPerMillion,args.prices.cachedInputMicrosPerMillion))+quoteUnits(args.bounds.maxOutputTokens,args.prices.outputMicrosPerMillion);
 const audit={model:args.modelName,promptVersion:contentPromptVersion,schemaVersion:'content-draft/1',requestHash,feedback,priceVersion:args.prices.version,priceCard:args.prices,bounds:args.bounds,countedInputTokens:counted};
 let receiptId:string|undefined;
 const result=await executeBudgeted(args.budget,{key:'content:'+workKey,month:currentBudgetMonth(),category:'content',estimateMicros,storyId:input.storyId,videoKey:args.kind==='script_es'?'dossier:'+input.dossierId:null,tool:'content-'+args.kind,toolVersion:'1',priceVersion:args.prices.version,inputHash:requestHash},async({operationId})=>{
  const current=await args.repository.input(args.briefId);if(current.inputHash!==input.inputHash)throw new Error('Evidence changed before dispatch');
  const response=await args.model.generateMetered(request,args.bounds,operationId);
  // Archive raw billed output before schema validation or a source-state race can reject it.
  await args.archive(operationId,response,audit);
  receiptId=await args.repository.record(operationId,args.briefId,input.inputHash,args.kind,response,audit);
  return {output:response,actualMicros:contentCost(response.usage,args.prices),usage:response.usage,reference:'content-receipt:'+receiptId};
 });
 const existing=receiptId?null:await args.repository.receipt(result.operationId);
 const response=result.status==='settled'?result.output:existing?.response;
 receiptId=receiptId||existing?.id;
 if(!receiptId||!response)return {status:'held' as const,operationId:result.operationId,reason:'Dispatched operation requires reconciliation; no automatic paid retry'};
 if(response.usage.input_tokens+response.usage.cached_input_tokens>args.bounds.maxInputTokens||response.usage.output_tokens+response.usage.thinking_tokens>args.bounds.maxOutputTokens)return {status:'invalid_output' as const,operationId:result.operationId,receiptId,reason:'Provider usage exceeded configured ceiling; actual usage retained and settled'};
 if(response.finishReason!=='STOP')return {status:'invalid_output' as const,operationId:result.operationId,receiptId,reason:'Incomplete provider output retained and metered'};
 let parsed:unknown;try{parsed=(args.kind==='script_es'?scriptDraftSchema:articleDraftSchema).parse(JSON.parse(response.text));}catch{return {status:'invalid_output' as const,operationId:result.operationId,receiptId,reason:'Malformed provider output retained and metered'};}
 const issues=contentDraftIssues(args.kind,parsed,input),draftId=await args.repository.save(receiptId);
 return {status:'draft' as const,draftId,receiptId,operationId:result.operationId,issues,usage:response.usage,computedCostMicros:contentCost(response.usage,args.prices),publication:'blocked'};
}
