import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {GeminiAdapter} from '@science/llm';
import {generateContentDraft,validateContentPrice,type ContentPriceCard} from '@science/pipeline';
import {createContentRepository,createBudgetStore} from '@science/storage';
import {contentKinds,type ContentKind} from '@science/core';

export async function runContent(briefId:string,kind:ContentKind,preflight=false) {
 if(process.env.SUPABASE_URL!=='http://127.0.0.1:56321')throw new Error('SCI-004 local Academy only; cloud dispatch is not enabled');
 if(!/^[a-f0-9-]{36}$/i.test(briefId)||!contentKinds.includes(kind))throw new Error('Existing brief UUID and article_es/article_en/script_es required');
 const repository=createContentRepository();const input=await repository.input(briefId);
 const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL,cardPath=process.env.CONTENT_PRICE_CARD;
 if(!key||!model||!cardPath)throw new Error('Configure Gemini credentials/model and CONTENT_PRICE_CARD; no calls made');
 const prices:ContentPriceCard=JSON.parse(await readFile(cardPath,'utf8'));validateContentPrice(prices,model);
 const bounds={maxInputTokens:20000,maxOutputTokens:16384,timeoutMs:120000};
 if(preflight)return {status:'ready_for_operator_run',inputHash:input.inputHash,briefId,kind,model,priceVersion:prices.version,bounds,paidCalls:0,publication:'blocked'};
 const adapter=new GeminiAdapter(key,model,async(operationId,raw)=>{const dir=resolve('artifacts/content-receipts/raw');await mkdir(dir,{recursive:true});await writeFile(join(dir,operationId+'.json'),raw,{flag:'wx',mode:0o600});});
 return generateContentDraft({briefId,kind,modelName:model,model:adapter,prices,bounds,budget:createBudgetStore(),repository,archive:async(operationId,response,audit)=>{
  const dir=resolve('artifacts/content-receipts');await mkdir(dir,{recursive:true});
  await writeFile(join(dir,operationId+'.json'),JSON.stringify({response,audit},null,2),{flag:'wx',mode:0o600});
 }});
}
