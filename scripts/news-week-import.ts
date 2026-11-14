/** Trusted operator import. Prepares cards through news_import; never approves or publishes. */
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newsPackageSchema} from '@science/core';
import {canonicalSourceId} from '@science/sources';
import {validateRemoteTarget} from './database-target.mjs';
const root=process.argv[2],apply=process.argv.includes('--apply');
if(!root)throw Error('Private preparation directory required');
if(apply&&!process.argv.includes('--production=news-003'))throw Error('Explicit NEWS-003 production import target required');
const source=await readFile(root+'/original-request.txt','utf8'),sourceHash=createHash('sha256').update(source).digest('hex');
const packages=(JSON.parse(await readFile(root+'/prepared-packages.json','utf8')) as unknown[]).map(p=>newsPackageSchema.parse(p));
if(packages.length!==17||new Set(packages.map(p=>p.section)).size!==17||packages.some(p=>p.period!=='2026-11-07/2026-11-14'||p.provenance.sourceHash!==sourceHash||!p.ru||!p['zh-Hans']))throw Error('Exact 17-story/four-language preparation contract required');
const primaryDois:Record<number,string[]>={5:['10.1038/s42005-026-02939-3'],6:['10.21203/rs.3.rs-11409330/v1'],7:['10.1016/j.cell.2026.10.031','10.64898/2026.04.14.717814'],8:['10.1038/s41593-026-02504-9','10.1101/2024.03.13.584921'],9:['10.1016/j.neuron.2026.10.009'],13:['10.1038/s43587-026-01270-4'],14:['10.1038/s43587-026-01262-4'],15:['10.1038/s41586-026-11282-0'],16:['10.1038/s41467-026-78736-x','2510.13696'],17:['10.1038/s42256-026-01335-4','2608.27221']};
function identity(url:string){try{return canonicalSourceId(url);}catch{const u=new URL(url);if(u.hostname==='www.nature.com'&&/^\/articles\/s[\w-]+$/.test(u.pathname))return canonicalSourceId('10.1038/'+u.pathname.split('/').pop());const bio=u.pathname.match(/\/(10\.(?:1101|64898)\/.+?)(?:v\d+)?(?:\.full(?:\.pdf)?)?$/);if(bio)return canonicalSourceId(bio[1]);return 'url:'+u.href;}}
const ca=process.env.SUPABASE_DB_CA_FILE?await readFile(process.env.SUPABASE_DB_CA_FILE,'utf8'):undefined;
const db=new pg.Client({connectionString:validateRemoteTarget(process.env.SUPABASE_DB_URL,'upwrplsgunjanragbggb'),ssl:{rejectUnauthorized:true,...ca?{ca}:{}},connectionTimeoutMillis:15000,statement_timeout:30000});
let commitAttempted=false,transactionCommitted=false;
try{
 await db.connect();await db.query(apply?'begin':'begin read only');
 if(apply)await db.query("select pg_advisory_xact_lock(hashtextextended('news-003:' || $1::text,0))",[sourceHash]);
 const batchBefore=(await db.query('select id,owner_authorization from academy.news_batches where source_hash=$1',[sourceHash])).rows[0];
 if(batchBefore?.owner_authorization)throw Error('This preparation must not inherit batch publication authorization');
 const plans=[];
 for(const p of packages){
  const primary=p.sources[0],ids=[...new Set([identity(primary.url),'url:'+primary.url,...(primaryDois[p.section]??[]).map(canonicalSourceId)])];
  const matched=(await db.query(`select distinct st.id,st.slug from academy.stories st where st.id in (
   select ss.story_id from academy.story_sources ss join academy.sources src on src.id=ss.source_id left join academy.source_aliases a on a.source_id=src.id where src.canonical_id=any($1) or a.alias=any($1) or src.url=$2
   union select story_id from academy.news_packages where event_key=$3
   union select id from academy.stories where slug=$4)`,[ids,primary.url,p.eventKey,p.slug])).rows;
  if(matched.length>1)throw Error('CANONICAL_IDENTITY_CONFLICT section '+p.section);
  const story=matched[0]??null;
  if(story&&story.slug!==p.slug)throw Error('Canonical story has another URL; prepare an explicit immutable update before import: '+p.section);
  const previous=story?(await db.query('select id,version,event_key from academy.news_packages where story_id=$1 order by version desc limit 1',[story.id])).rows[0]:null;
  plans.push({section:p.section,slug:p.slug,primaryIdentities:ids,storyId:story?.id??null,eventChange:previous?previous.event_key!==p.eventKey:false,previousPackage:previous?.id??null});
 }
 if(!apply){await db.query('commit');await writeFile(root+'/import-plan.json',JSON.stringify({sourceHash,existingBatch:batchBefore?.id??null,ownerAuthorization:null,plans},null,2));console.log(JSON.stringify({dryRun:true,stories:plans.length,reused:plans.filter(p=>p.storyId).length,sourceHash,plans}));}
 else{
  if(!(await db.query("select 1 from academy.install_migrations where version='202611140016_news_languages.sql'")).rowCount)throw Error('Scoped language migration must be installed first');
  const batch=batchBefore?.id??(await db.query("insert into academy.news_batches(source_text,period_start,period_end,owner_authorization) values($1,'2026-11-07','2026-11-14',null) returning id",[source])).rows[0].id;
  const receipts=[];
  for(const p of packages){
   const plan=plans.find(x=>x.section===p.section)!;
   const packageId=(await db.query('select academy.news_import($1,$2,$3) id',[batch,plan.storyId,p])).rows[0].id;
   const saved=(await db.query('select story_id,version,package_hash from academy.news_packages where id=$1',[packageId])).rows[0];
   for(const s of p.sources){
    const canonical=identity(s.url);
    await db.query('insert into academy.sources(canonical_id,url,title_en,kind,metadata) values($1,$2,$3,$4,$5) on conflict(canonical_id) do nothing',[canonical,s.url,s.title,s.kind,{origin:'news-003/1',access:s.access,checkedAt:s.checkedAt,sourceCheck:s.finding,independentScientificVerification:'not_performed'}]);
    const sourceId=(await db.query('select id from academy.sources where canonical_id=$1',[canonical])).rows[0].id;
    await db.query('insert into academy.story_sources(story_id,source_id) values($1,$2) on conflict do nothing',[saved.story_id,sourceId]);
   }
   const state=(await db.query('select decision,version,package_id from academy.news_state where story_id=$1',[saved.story_id])).rows[0];
   receipts.push({number:p.section,storyId:saved.story_id,packageId,packageVersion:saved.version,packageHash:saved.package_hash,currentPackage:state.package_id,stateVersion:state.version,decision:state.decision,status:'prepared',cardUrl:`https://dobrov.org/editorial/news?view=all&q=${encodeURIComponent(p.slug)}#story-${saved.story_id}`,languages:Object.fromEntries(['es','en','ru','zh-Hans'].map(l=>[l,{status:'prepared_not_published',url:`https://dobrov.org${l==='es'?'/noticias':l==='zh-Hans'?'/zh/news':'/'+l+'/news'}/${p.slug}`}]))});
  }
  commitAttempted=true;await db.query('commit');transactionCommitted=true;
  await writeFile(root+'/import-receipts.json',JSON.stringify({batchId:batch,sourceHash,importedAt:new Date().toISOString(),ownerAuthorization:null,publicationCalls:0,receipts},null,2));console.log(JSON.stringify({imported:receipts.length,languageVersions:68,batchId:batch,publicationCalls:0,states:receipts.map(r=>({number:r.number,storyId:r.storyId,decision:r.decision}))}));
 }
}catch(e:any){if(!transactionCommitted)await db.query('rollback').catch(()=>{});console.error(JSON.stringify({status:transactionCommitted?'committed_receipt_missing':commitAttempted?'commit_uncertain':'stopped',code:e.code??'IMPORT_GUARD',sourceHash,reason:transactionCommitted?'Database import committed. Reconcile the exact source hash before reconstructing the local receipt.':commitAttempted?'Commit outcome uncertain. Query the exact source hash and package hashes before any retry.':e.code?'Database query failed before commit; transaction rolled back.':e.message}));process.exitCode=1;}finally{await db.end();}
