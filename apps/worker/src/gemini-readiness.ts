import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {inspectGeminiModel} from '../../../packages/llm/src/gemini-readiness';
import {validateContentPrice,contentCost} from '@science/pipeline';
const model=process.env.GEMINI_MODEL||'gemini-3-flash-preview';
let priceCardValid=false,priceVersion:string|null=null,reservationMicrosPerOutput:number|null=null;
try {
 if(process.env.CONTENT_PRICE_CARD){const card=JSON.parse(await readFile(process.env.CONTENT_PRICE_CARD,'utf8'));validateContentPrice(card,model);priceCardValid=true;priceVersion=card.version;
 reservationMicrosPerOutput=contentCost({input_tokens:20000,cached_input_tokens:0,output_tokens:16384,thinking_tokens:0},card);}
} catch {/* Never emit credential/configuration contents or provider errors. */}
const metadata=await inspectGeminiModel(process.env.GEMINI_API_KEY||'',model);
const report={checkedAt:new Date().toISOString(),readOnly:true,expectedProject:'gen-lang-client-0531547795',projectAssociation:'requires_owner_or_authenticated_project_check',billingState:'not_verified_by_models_get',modelMetadata:metadata,
 structuredOutput:'documented_support; exact generation schema not exercised',priceCardValid,priceVersion,reservationMicrosPerOutput,reservationMicrosForThreeOutputs:reservationMicrosPerOutput===null?null:reservationMicrosPerOutput*3,
 generationRequests:0,countTokensRequests:0,billingChanges:0,paidCallsAuthorized:false};
await mkdir('artifacts/readiness',{recursive:true});await writeFile('artifacts/readiness/gemini.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
