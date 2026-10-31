import {describe,it,expect,vi} from 'vitest';
import {contentDraftIssues} from '@science/core';
import {contentSceneDrafts} from '@science/video';
import {parseGeminiReceipt,GeminiAdapter} from '@science/llm';
import {contentCost,generateContentDraft,validateContentPrice,currentBudgetMonth,writerRequest,type ContentRepository,type ContentPriceCard} from '@science/pipeline';
import {contentInputFixture,contentArticleFixture,contentScriptFixture} from './fixtures/content';
const input=contentInputFixture();
const price:ContentPriceCard={version:'synthetic-price-test',model:'fixture-model',billingTier:'paid',reviewedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),sourceUrl:'https://ai.google.dev/gemini-api/docs/pricing',inputMicrosPerMillion:1000000,cachedInputMicrosPerMillion:100000,outputMicrosPerMillion:2000000};
describe('SCI-004 content contracts and metering',()=>{
 it('accepts independently mapped ES/EN drafts with eight sections',()=>{for(const language of ['es','en'] as const)expect(contentDraftIssues(language==='en'?'article_en':'article_es',contentArticleFixture(input,language),input)).toEqual([]);});
 it('flags unsupported assertions, missing sections, wrong language and caveats',()=>{
  const draft=contentArticleFixture();draft.sections[0].paragraphs[0].claimIds=[];draft.sections[1].key=draft.sections[0].key;draft.language='en';draft.sections.forEach(s=>s.paragraphs.forEach(p=>p.caveatIds=[]));
  expect(contentDraftIssues('article_es',draft,input)).toEqual(expect.arrayContaining(['unmapped_assertion','missing_article_section','language_mismatch','missing_mandatory_caveat']));
  draft.sections[0].paragraphs[0].claimIds=['99999999-9999-4999-8999-999999999999'];expect(contentDraftIssues('article_es',draft,input)).toContain('unapproved_claim');
  draft.sections[0].paragraphs[0].text='Improved by 928471%.';expect(contentDraftIssues('article_es',draft,input)).toContain('unverified_quantity');
 });
 it('maps Spanish script drafts into VIDEO-001 scenes without manufacturing assets or reviews',()=>{
  const script=contentScriptFixture();expect(contentDraftIssues('script_es',script,input)).toEqual([]);
  const scenes=contentSceneDrafts(script,'revision','e'.repeat(64),input);expect(scenes[0].audioAsset).toBeNull();expect(scenes.every(s=>s.scientificReview.status==='pending')).toBe(true);
  script.scenes[3].type='presenter_insert';expect(contentDraftIssues('script_es',script,input)).toEqual(expect.arrayContaining(['presenter_not_optional','script_duration_estimate_outside_pilot','caveat_scene_required']));
 });
 it('requires real usage metadata and includes reasoning/cache in exact cost',()=>{
  const receipt=parseGeminiReceipt({responseId:'synthetic-response',usageMetadata:{promptTokenCount:100,cachedContentTokenCount:20,candidatesTokenCount:10,thoughtsTokenCount:5,totalTokenCount:115},candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]});
  expect(contentCost(receipt.usage,price)).toBe(112);
  expect(()=>parseGeminiReceipt({responseId:'x',usageMetadata:{promptTokenCount:1}})).toThrow(/metering/);
  expect(()=>validateContentPrice({...price,model:'other'},price.model)).toThrow();expect(()=>validateContentPrice({...price,expiresAt:'2000-01-01'},price.model)).toThrow();
 });
 it('archives raw provider response before rejecting unavailable metering',async()=>{
  const raw=JSON.stringify({responseId:'synthetic-incomplete',usageMetadata:{},candidates:[]}),sink=vi.fn(async()=>{});
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(raw,{status:200})));
  try {await expect(new GeminiAdapter('synthetic-key','fixture-model',sink).generateMetered(writerRequest('article_es',input),{maxInputTokens:20000,maxOutputTokens:8192,timeoutMs:1000},'op')).rejects.toThrow(/metering/);expect(sink).toHaveBeenCalledWith('op',raw);}finally{vi.unstubAllGlobals();}
 });
 it('counts the complete request and enforces input ceiling without generation',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({totalTokens:20001}),{status:200}));vi.stubGlobal('fetch',fetcher);
  try {await expect(new GeminiAdapter('synthetic-key','fixture-model').countInput(writerRequest('article_es',input),{maxInputTokens:20000,maxOutputTokens:8192,timeoutMs:1000})).rejects.toThrow(/ceiling/);const call=fetcher.mock.calls[0] as any;expect(call[0]).toMatch(/:countTokens$/);expect(JSON.parse(call[1].body).generateContentRequest.systemInstruction).toBeDefined();expect(call[1].redirect).toBe('error');}finally{vi.unstubAllGlobals();}
 });
 function setup(text=JSON.stringify(contentArticleFixture())) {
  const response={text,finishReason:'STOP',receipt:'synthetic-response',provider:'google' as const,model:'fixture-model',promptVersion:'evidence-writer/1',durationMs:1,usage:{input_tokens:100,cached_input_tokens:0,output_tokens:20,thinking_tokens:5}};
  const model={countInput:vi.fn(async()=>100),generateMetered:vi.fn(async()=>response)};
  const repository:ContentRepository={input:vi.fn(async()=>input),receipt:vi.fn(async()=>null),record:vi.fn(async()=>'receipt-id'),save:vi.fn(async()=>'draft-id')};
  const budget={reserve:vi.fn(async()=>({id:'op',state:'reserved' as const})),start:vi.fn(async()=>'token'),settle:vi.fn(async()=>{}),uncertain:vi.fn(async()=>{}),release:vi.fn(async()=>{})};
  return {args:{briefId:input.briefId,kind:'article_es' as const,modelName:'fixture-model',model,prices:price,bounds:{maxInputTokens:20000,maxOutputTokens:8192,timeoutMs:1000},budget,repository,archive:vi.fn(async()=>{})},response};
 }
 it('reserves and starts before dispatch; archives receipt before settlement and saves afterwards',async()=>{
  const {args}=setup();const result=await generateContentDraft(args);expect(result.status).toBe('draft');expect(args.budget.reserve.mock.calls[0]).toEqual([expect.objectContaining({month:currentBudgetMonth(),category:'content'})]);
  expect(args.budget.start.mock.invocationCallOrder[0]).toBeLessThan(args.model.generateMetered.mock.invocationCallOrder[0]);expect(args.archive.mock.invocationCallOrder[0]).toBeLessThan(args.budget.settle.mock.invocationCallOrder[0]);
 });
 it('rejects a stale/unapproved input before any provider contact',async()=>{
  const {args}=setup();vi.mocked(args.repository.input).mockRejectedValue(new Error('stale'));await expect(generateContentDraft(args)).rejects.toThrow('stale');expect(args.model.countInput).not.toHaveBeenCalled();expect(args.model.generateMetered).not.toHaveBeenCalled();
 });
 it('settles billed malformed output, retains provenance and never saves it as a draft',async()=>{
  const {args}=setup('malformed JSON');expect((await generateContentDraft(args)).status).toBe('invalid_output');expect(args.budget.settle).toHaveBeenCalled();expect(args.repository.save).not.toHaveBeenCalled();
 });
 it('holds uncertain calls without releasing funds or automatically replaying paid work',async()=>{
  const {args}=setup();args.model.generateMetered.mockRejectedValue(new Error('timeout'));await expect(generateContentDraft(args)).rejects.toThrow(/reconciliation/);expect(args.budget.uncertain).toHaveBeenCalled();expect(args.budget.release).not.toHaveBeenCalled();
 });
 it('recovers a settled archived draft without repeating generation',async()=>{
  const {args,response}=setup();args.budget.reserve.mockResolvedValue({id:'op',state:'settled'} as any);vi.mocked(args.repository.receipt).mockResolvedValue({id:'receipt-id',response});expect((await generateContentDraft(args)).status).toBe('draft');expect(args.model.generateMetered).not.toHaveBeenCalled();
 });
});
