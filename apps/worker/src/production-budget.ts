/** Local production tooling only: no cloud URL, provider calls or publication. */
import { createClient } from '@supabase/supabase-js';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createBudgetStore } from '@science/storage';
import { currentBudgetMonth,microdollars,executeBudgeted,productionInputHash,metadataReview,productionPlan,productionCategories,type ProductionRateCard } from '@science/pipeline';
const url = process.env.SUPABASE_URL;
if (url !== 'http://127.0.0.1:56321' || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Production budget CLI requires local Academy configuration');
const db = createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false}});
const [command,argument,ratePath] = process.argv.slice(2);
const month = currentBudgetMonth();
if (command === 'init') {
  const config = JSON.parse(await readFile(argument || 'config/production-budget.example.json','utf8'));
  const {error} = await db.rpc('budget_configure',{p_month:month,p_limit:microdollars(config.monthlyUsd),
    p_categories:Object.fromEntries(productionCategories.map(c=>[c,microdollars(config.categoriesUsd[c])])),p_story:microdollars(config.storyUsd),p_video:microdollars(config.videoUsd)});
  if (error) throw new Error('Budget initialization failed; check configuration or an existing monthly plan');
  console.log(JSON.stringify({event:'budget.configured',month,monthlyUsd:config.monthlyUsd,local:true,paidCalls:0}));
} else if (command === 'recover') {
  const {data,error}=await db.rpc('budget_recover',{p_month:argument || month});
  if(error) throw new Error('Local budget recovery failed');
  console.log(JSON.stringify({event:'budget.recovered',month:argument || month,...data,paidCalls:0}));
} else if (command === 'plan') {
  // Explicit bounds, narration and optional reviewed rates; no fake "free" quote when rates are absent.
  if (!argument) throw new Error('Use plan <production-input.json> [reviewed-price-card.json]');
  const input = JSON.parse(await readFile(argument,'utf8'));
  const card: ProductionRateCard | undefined = ratePath ? JSON.parse(await readFile(ratePath,'utf8')) : undefined;
  const plan = productionPlan(input,card);
  await mkdir('artifacts/production',{recursive:true});
  await writeFile('artifacts/production/plan.json',JSON.stringify(plan,null,2));
  console.log(JSON.stringify({event:'production.planned',path:'artifacts/production/plan.json',priced:!!card,totalMicros:plan.totalMicros,paidCalls:0}));
} else if (command === 'review') {
  if (!argument || !/^[a-f0-9-]{36}$/i.test(argument)) throw new Error('Use review <local-story-uuid>');
  const {data:story,error}=await db.from('stories').select('id,title_en,story_sources(sources(canonical_id,metadata))').eq('id',argument).single();
  if(error || !story) throw new Error('Local story is unavailable');
  const sources = story.story_sources.map(s=>s.sources as unknown as {canonical_id:string;metadata:{primarySourceRequired?:boolean;flags?:string[]}}).filter(Boolean);
  const input={titleEn:story.title_en,identifiers:sources.map(s=>s.canonical_id),primarySourceRequired:sources.some(s=>s.metadata.primarySourceRequired),flags:sources.flatMap(s=>s.metadata.flags||[])};
  const hash=productionInputHash(JSON.stringify(input));
  const store=createBudgetStore();
  const result=await executeBudgeted(store,{key:`metadata-review:${story.id}:${hash}`,month,category:'news_analysis',estimateMicros:0,storyId:story.id,videoKey:null,tool:'local-metadata-review',toolVersion:'1',priceVersion:'local-no-provider-charge/1',inputHash:hash},async ({operationId})=>{
    const output=metadataReview(input);
    await mkdir('artifacts/production',{recursive:true});
    const path=`artifacts/production/${operationId}.json`;
    await writeFile(path,JSON.stringify(output,null,2));
    return {output:{path},actualMicros:0,usage:{},reference:`local-artifact:${operationId}`};
  });
  console.log(JSON.stringify({event:'production.metadata-reviewed',...result,paidCalls:0}));
} else if(command==='rehearse') {
  // Four metering paths, all clearly synthetic and zero-charge, never model/TTS/render output.
  const store=createBudgetStore(); const run=randomUUID();
  const {data:story,error}=await db.from('stories').select('id').eq('id',argument||'').single();
  if(error || !story) throw new Error('Use rehearse <local-story-uuid>');
  for (const category of productionCategories) {
    const result=await executeBudgeted(store,{key:`rehearsal:${run}:${category}`,month,category,estimateMicros:0,storyId:story.id,videoKey:`rehearsal:${run}`,tool:'synthetic-metering',toolVersion:'1',priceVersion:'synthetic-zero/1',inputHash:productionInputHash(`${run}:${category}`)},async()=>({output:null,actualMicros:0,usage:{},reference:`synthetic:${run}:${category}`}));
    console.log(JSON.stringify({event:'budget.rehearsed',category,status:result.status,synthetic:true,paidCalls:0}));
  }
} else throw new Error('Use init | recover | plan | review | rehearse');
