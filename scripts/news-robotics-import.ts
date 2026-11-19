/** Trusted operator import. Prepares cards through news_import; never approves or publishes. */
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newsPackageSchema} from '@science/core';
import {canonicalNewsIdentity as identity,resolveNewsIdentity,type NewsIdentityCandidate} from './news-import-match';
import {validateRemoteTarget} from './database-target.mjs';
const root=process.argv[2],apply=process.argv.includes('--apply');
if(!root)throw Error('Private preparation directory required');
if(apply&&!process.argv.includes('--production=news-robotics-2026-11-15'))throw Error('Explicit three-story production import target required');
const source=await readFile(root+'/original-request.txt','utf8'),sourceHash=createHash('sha256').update(source).digest('hex');
const packages=(JSON.parse(await readFile(root+'/prepared-packages.json','utf8')) as unknown[]).map(p=>newsPackageSchema.parse(p));
if(sourceHash!=='8ae4289c6435cad66a0fbebd322f6c02b3d39d5fcbdea2ee3421bde89d10cfd6'||packages.length!==3||packages.map(p=>p.section).sort().join(',')!=='1,2,3'||packages.some(p=>p.period!=='standalone:2026-11-15'||p.provenance.sourceHash!==sourceHash||!p.ru||!p['zh-Hans']||p.verification.status!=='checked_summary'||p.research?.languageChecks.some(c=>c.status!=='checked')))throw Error('Exact additional three-story/four-language preparation contract required');
const identities=JSON.parse(await readFile(root+'/primary-identities.json','utf8')) as {section:number;identifiers:string[]}[];
if(identities.length!==3||new Set(identities.map(i=>i.section)).size!==3||identities.some(i=>!packages.some(p=>p.section===i.section)||!Array.isArray(i.identifiers)||!i.identifiers.length||i.identifiers.some(v=>typeof v!=='string'||!v.trim())))throw Error('Three explicit canonical identity records required');
const ca=process.env.SUPABASE_DB_CA_FILE?await readFile(process.env.SUPABASE_DB_CA_FILE,'utf8'):undefined;
const db=new pg.Client({connectionString:validateRemoteTarget(process.env.SUPABASE_DB_URL,'upwrplsgunjanragbggb'),ssl:{rejectUnauthorized:true,...ca?{ca}:{}},connectionTimeoutMillis:15000,statement_timeout:30000});
let commitAttempted=false,transactionCommitted=false;
try{
 await db.connect();await db.query(apply?'begin':'begin read only');
 if(apply)await db.query("select pg_advisory_xact_lock(hashtextextended('news-robotics:' || $1::text,0))",[sourceHash]);
 const batchBefore=(await db.query('select id,owner_authorization from academy.news_batches where source_hash=$1',[sourceHash])).rows[0];
 if(batchBefore?.owner_authorization)throw Error('This preparation must not inherit batch publication authorization');
 const plans=[];
 for(const p of packages){
  const raw=identities.find(i=>i.section===p.section)!.identifiers;
  const ids=[...new Set(raw.map(identity))],primaryUrls=raw.filter(v=>v.startsWith('https://'));
  const citedIds=new Set(p.sources.flatMap(s=>[identity(s.url),...(s.related??[]).map(r=>identity(r.url))]));
  if(ids.some(id=>!citedIds.has(id)))throw Error('Primary identity must have a checked package source: '+p.section);
  const candidates=(await db.query(`select distinct st.id,st.slug,(st.slug=$4 or exists(select 1 from academy.news_packages p where p.story_id=st.id and p.event_key=$3)) as direct,(select content#>>'{sources,0,url}' from academy.news_packages p where p.story_id=st.id order by p.version desc limit 1) as first_source from academy.stories st where st.id in (
   select ss.story_id from academy.story_sources ss join academy.sources src on src.id=ss.source_id left join academy.source_aliases a on a.source_id=src.id where src.canonical_id=any($1) or a.alias=any($1) or src.url=any($2)
   union select story_id from academy.news_packages where event_key=$3
   union select id from academy.stories where slug=$4)`,[ids,primaryUrls,p.eventKey,p.slug])).rows;
  // The pre-existing physical-AI analysis cites these announcements as background.
  // The owner's current request explicitly identifies three separate news events.
  const overview=candidates.find(c=>c.id==='b5b56a53-ff60-4ad9-916e-20d6ef6cf7fc');
  if(overview&&(overview.direct||overview.slug!=='physical-ai-us-china-reliability-economics'))throw Error('Overview identity changed; manual reconciliation required');
  const {story,contextMatches}=resolveNewsIdentity(candidates.filter(c=>c!==overview) as NewsIdentityCandidate[],ids);
  if(overview)contextMatches.push(overview.id);
  if(story&&story.slug!==p.slug)throw Error('Canonical story has another URL; prepare an explicit immutable update before import: '+p.section);
  const previous=story?(await db.query('select id,version,event_key,content=$2::jsonb as identical from academy.news_packages where story_id=$1 order by version desc limit 1',[story.id,p])).rows[0]:null;
  if(previous&&!previous.identical&&!p.changes.length)throw Error('An update must document its changes: '+p.section);
  plans.push({section:p.section,slug:p.slug,primaryIdentities:ids,contextMatches,storyId:story?.id??null,eventChange:previous?previous.event_key!==p.eventKey:false,previousPackage:previous?.id??null});
 }
 if(!apply){await db.query('commit');await writeFile(root+'/import-plan.json',JSON.stringify({sourceHash,existingBatch:batchBefore?.id??null,ownerAuthorization:null,plans},null,2));console.log(JSON.stringify({dryRun:true,stories:plans.length,reused:plans.filter(p=>p.storyId).length,sourceHash,plans}));}
 else{
  if(!(await db.query("select 1 from academy.install_migrations where version='202611140016_news_languages.sql'")).rowCount)throw Error('Scoped language migration must be installed first');
  const preservedBefore=(await db.query("select jsonb_build_object('releases',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from academy.news_releases r),'decisions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from academy.news_decisions d),'states',(select coalesce(jsonb_agg(to_jsonb(s) order by s.story_id),'[]'::jsonb) from academy.news_state s where not(s.story_id=any($1::uuid[])))) data",[plans.flatMap(p=>p.storyId?[p.storyId]:[])])).rows[0].data;
  const batch=batchBefore?.id??(await db.query("insert into academy.news_batches(source_text,period_start,period_end,owner_authorization) values($1,'2026-11-15','2026-11-15',null) returning id",[source])).rows[0].id;
  const receipts=[];
  for(const p of packages){
   const plan=plans.find(x=>x.section===p.section)!;
   const packageId=(await db.query('select academy.news_import($1,$2,$3) id',[batch,plan.storyId,p])).rows[0].id;
   const saved=(await db.query('select story_id,version,package_hash from academy.news_packages where id=$1',[packageId])).rows[0];
   for(const s of p.sources){
    const canonical=identity(s.url);
    await db.query('insert into academy.sources(canonical_id,url,title_en,kind,metadata) values($1,$2,$3,$4,$5) on conflict(canonical_id) do nothing',[canonical,s.url,s.title,s.kind,{origin:'news-robotics-2026-11-15',access:s.access,checkedAt:s.checkedAt,sourceCheck:s.finding,independentScientificVerification:'not_performed'}]);
    const sourceId=(await db.query('select id from academy.sources where canonical_id=$1',[canonical])).rows[0].id;
    await db.query('insert into academy.story_sources(story_id,source_id) values($1,$2) on conflict do nothing',[saved.story_id,sourceId]);
   }
   const state=(await db.query('select decision,version,package_id from academy.news_state where story_id=$1',[saved.story_id])).rows[0];
   const released=(await db.query('select language from academy.news_releases where package_id=$1 order by language',[packageId])).rows.map(r=>r.language);
   receipts.push({number:p.section,storyId:saved.story_id,packageId,packageVersion:saved.version,packageHash:saved.package_hash,currentPackage:state.package_id,stateVersion:state.version,decision:state.decision,status:released.length===4?'published':'prepared',cardUrl:`https://dobrov.org/editorial/news?view=all&q=${encodeURIComponent(p.slug)}#story-${saved.story_id}`,languages:Object.fromEntries(['es','en','ru','zh-Hans'].map(l=>[l,{status:released.includes(l)?'published':'prepared_not_published',previewUrl:`https://dobrov.org/editorial/news?view=all&q=${encodeURIComponent(p.slug)}&language=${l}#story-${saved.story_id}`,url:`https://dobrov.org${l==='es'?'/noticias':l==='zh-Hans'?'/zh/news':'/'+l+'/news'}/${p.slug}`}]))});
  }
  const preservedAfter=(await db.query("select jsonb_build_object('releases',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) from academy.news_releases r),'decisions',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from academy.news_decisions d),'states',(select coalesce(jsonb_agg(to_jsonb(s) order by s.story_id),'[]'::jsonb) from academy.news_state s where not(s.story_id=any($1::uuid[])))) data",[receipts.map(r=>r.storyId)])).rows[0].data;
  if(JSON.stringify(preservedBefore)!==JSON.stringify(preservedAfter))throw Error('Existing releases, decisions or unrelated states changed; rolling back.');
  commitAttempted=true;await db.query('commit');transactionCommitted=true;
  await writeFile(root+'/import-receipts.json',JSON.stringify({batchId:batch,sourceHash,importedAt:new Date().toISOString(),ownerAuthorization:null,publicationCalls:0,preservedReleases:preservedBefore.releases.length,preservedDecisions:preservedBefore.decisions.length,unrelatedStatesUnchanged:true,receipts},null,2));console.log(JSON.stringify({imported:receipts.length,languageVersions:12,batchId:batch,publicationCalls:0,states:receipts.map(r=>({number:r.number,storyId:r.storyId,decision:r.decision}))}));
 }
}catch(e:any){if(!transactionCommitted)await db.query('rollback').catch(()=>{});console.error(JSON.stringify({status:transactionCommitted?'committed_receipt_missing':commitAttempted?'commit_uncertain':'stopped',code:e.code??'IMPORT_GUARD',sourceHash,reason:transactionCommitted?'Database import committed. Reconcile the exact source hash before reconstructing the local receipt.':commitAttempted?'Commit outcome uncertain. Query the exact source hash and package hashes before any retry.':e.code?'Database query failed before commit; transaction rolled back.':e.message}));process.exitCode=1;}finally{await db.end();}



