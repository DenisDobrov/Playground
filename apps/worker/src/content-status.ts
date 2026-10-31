/** Read-only local preflight. It never creates a brief, approval or provider operation. */
import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {currentBudgetMonth,validateContentPrice} from '@science/pipeline';
if(process.env.SUPABASE_URL!=='http://127.0.0.1:56321')throw new Error('Local Academy only');
const dossier=process.argv[2];if(!/^[a-f0-9-]{36}$/i.test(dossier||''))throw new Error('Dossier UUID required');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY!,{db:{schema:'academy'},auth:{persistSession:false}});
const [state,brief,period]=await Promise.all([db.rpc('research_review_state',{p_dossier:dossier}),db.from('editorial_briefs').select('id,review_ids').eq('dossier_id',dossier).eq('preliminary',false),db.from('budget_periods').select('month').eq('month',currentBudgetMonth()).maybeSingle()]);
if(state.error||brief.error||period.error)throw new Error('Local content preflight unavailable');
const current=state.data?.ready?brief.data?.find(b=>JSON.stringify(b.review_ids)===JSON.stringify(state.data.reviewIds)):null;
let priceReady=false;try {if(process.env.CONTENT_PRICE_CARD){validateContentPrice(JSON.parse(await readFile(process.env.CONTENT_PRICE_CARD,'utf8')),process.env.GEMINI_MODEL||'');priceReady=true;}}catch{/* report missing configuration without logging local values */}
const result={event:'content.preflight',checkedAt:new Date().toISOString(),dossierId:dossier,researchGate:state.data,approvedBriefId:current?.id||null,configuration:{apiKeyConfigured:!!process.env.GEMINI_API_KEY,modelConfigured:!!process.env.GEMINI_MODEL,reviewedPricesConfigured:priceReady,currentBudgetConfigured:!!period.data},providerCalls:0,modelUsage:null,providerCostMicros:0,publication:'blocked',ready:!!current&&!!process.env.GEMINI_API_KEY&&!!process.env.GEMINI_MODEL&&priceReady&&!!period.data};
await mkdir('artifacts/content-pilot',{recursive:true});await writeFile('artifacts/content-pilot/preflight.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
