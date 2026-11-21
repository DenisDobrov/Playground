/** Local-only KB acceptance. Every fixture and decision rolls back. No cloud/model calls. */
import pg from 'pg';import {readFile} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {newsFixture} from '../fixtures/news';
import type {KnowledgeSearch,KnowledgeSuggestion} from '../../packages/core/src/knowledge';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres',connectionTimeoutMillis:15000});
const editor=randomUUID(),reviewer=randomUUID(),outsider=randomUUID(),rpc='select academy.knowledge_decide_context($1,$2,$3,$4,$5,$6,$7) id';
const one=async(sql:string,args:unknown[]=[]) => (await db.query(sql,args)).rows[0];
async function role(value:string){await db.query('reset role');if(value==='postgres')return;if(['anon','service_role'].includes(value)){await db.query('set local role '+value);return;}await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[value]);}
async function denied(sql:string,args:unknown[]=[],code?:string){await db.query('savepoint denied');let error:any;try{await db.query(sql,args);}catch(e){error=e;}await db.query('rollback to savepoint denied');await db.query('release savepoint denied');assert.ok(error,'Operation must fail');if(code)assert.equal(error.code,code);}
try{
 await db.connect();await db.query('begin');
 if(!(await one("select to_regclass('academy.knowledge_records') yes")).yes)await db.query(await readFile('supabase/migrations/202611210018_knowledge_base.sql','utf8'));
 for(const id of [editor,reviewer,outsider])await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@synthetic.invalid']);
 await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",[editor,reviewer]);
 const marker='SYNTHETIC KB '+randomUUID(),hash=createHash('sha256').update(marker).digest('hex');
 const batch=(await one("insert into academy.news_batches(source_text,period_start,period_end) values($1,'2026-11-21','2026-11-21') returning id",[marker])).id;
 const p=newsFixture(hash);p.slug='synthetic-kb-'+randomUUID();p.eventKey=p.slug;p.en.tags=['SYNTHETIC KB TOPIC'];p.es.tags=['SYNTHETIC KB TOPIC'];
 await role('service_role');const target=(await one('select academy.news_import($1,null,$2) id',[batch,p])).id;
 await role('postgres');
 const source=(await one('insert into academy.sources(canonical_id,url,title_en,kind) values($1,$2,$3,$4) returning id',['doi:10.9999/'+randomUUID(),p.sources[0].url,marker+' 50%_α','paper'])).id;
 for(let i=0;i<22;i++)await db.query('insert into academy.sources(canonical_id,url,title_en,kind) values($1,$2,$3,$4)',['doi:10.9999/'+randomUUID(),'https://example.org/'+i,marker+' page '+i,'paper']);
 const story=(await one('select story_id from academy.news_packages where id=$1',[target])).story_id;
 await db.query("insert into academy.editorial_decisions(story_id,actor_type,actor_id,decision,reason,policy_version) values($1,'human',$2,'reject',$3,'synthetic')",[story,editor,marker+' rejected because too technical']);
 const preserved=async()=>one("select jsonb_build_object('state',(select to_jsonb(s) from academy.news_state s where package_id=$1),'publications',(select count(*) from academy.news_releases where package_id=$1),'decisions',(select count(*) from academy.news_decisions where package_id=$1),'outbox',(select count(*) from academy.news_outbox where package_id=$1),'reviews',(select count(*) from academy.scientific_reviews),'jobs',(select count(*) from academy.production_jobs)) data",[target]);
 const before=await preserved();
 await role(editor);const record=await one('select * from academy.knowledge_records where entry_key=$1',['source:'+source]);
 assert.equal(record.payload.status,'metadata');
 const search=async(q:string,kind='all',page=1,history=false)=>(await one('select academy.knowledge_search($1,$2,$3,$4) result',[q,kind,page,history])).result as KnowledgeSearch;
 const first=await search(marker,'source');assert.equal(first.total,23);assert.equal(first.items.length,20);const second=await search(marker,'source',2);assert.equal(second.items.length,3);assert.equal(new Set([...first.items,...second.items].map(r=>r.entry_key)).size,23);
 assert.equal((await search('50%_α','source')).total,1,'Literal wildcard and Unicode search');
 assert.equal((await search(marker+' rejected','decision')).items[0].payload.status,'reject','Rejected decisions remain available');
 assert.equal((await search('SYNTHETIC KB TOPIC','topic')).total,1,'Literal EN/ES tag dedup');
 const suggestions=(await one('select academy.knowledge_suggestions($1) result',[target])).result as KnowledgeSuggestion[];
 assert.ok(suggestions.some(s=>s.entry_key===record.entry_key&&s.reason.includes('URL')),'Source match rationale is explicit');
 for(const actor of [reviewer,outsider,'anon','service_role']){await role(actor);await denied(rpc,[target,record.entry_key,record.record_hash,null,randomUUID(),'accept',''],'42501');}
 await role('anon');await denied('select * from academy.knowledge_records',[],'42501');await denied('select academy.knowledge_search()',[],'42501');
 await role(outsider);assert.equal((await db.query('select * from academy.knowledge_records')).rowCount,0);await denied('select academy.knowledge_search()',[],'42501');
 await role(reviewer);assert.ok((await search(marker)).total>0,'Reviewer can read');
 await role(editor);await denied('insert into academy.knowledge_context_decisions default values',[],'42501');
 await denied(rpc,[target,record.entry_key,'a'.repeat(64),null,randomUUID(),'accept',''],'40001');
 const args=[target,record.entry_key,record.record_hash,null,randomUUID(),'accept','Owner context only; not scientific verification.'];
 const accepted=(await one(rpc,args)).id;assert.equal((await one(rpc,args)).id,accepted,'Exact replay');
 await denied(rpc,[...args.slice(0,6),'changed'],'22023');
 await denied(rpc,[target,record.entry_key,record.record_hash,null,randomUUID(),'reject',''],'40001');
 const rejected=(await one(rpc,[target,record.entry_key,record.record_hash,accepted,randomUUID(),'reject','Optional comment'])).id;
 const saved=await one('select * from academy.knowledge_context_decisions where id=$1',[rejected]);assert.equal(saved.actor_id,editor);assert.equal(saved.previous_id,accepted);assert.equal(saved.entry_snapshot.title,record.title);assert.ok(saved.rationale.includes('URL'));
 const latest=(await one('select academy.knowledge_context_latest($1) result',[target])).result;assert.equal(latest.length,1);assert.equal(latest[0].id,rejected,'Latest link list deduplicates history');
 await denied('update academy.knowledge_context_decisions set comment=$1 where id=$2',['forged',accepted],'42501');
 assert.deepEqual(await preserved(),before,'Context writes do not approve, publish, schedule jobs or change science');
 await role('postgres');await denied('delete from academy.knowledge_context_decisions where id=$1',[accepted]);
 await db.query('update academy.sources set title_en=$1 where id=$2',[marker+' changed metadata',source]);
 await role(editor);await denied(rpc,[target,record.entry_key,record.record_hash,rejected,randomUUID(),'accept',''],'40001');
 assert.equal((await one('select entry_snapshot->>\'title\' title from academy.knowledge_context_decisions where id=$1',[accepted])).title,record.title,'Old snapshot immutable');
 await role('service_role');p.en.title+=' updated';const newer=(await one('select academy.news_import($1,$2,$3) id',[batch,story,p])).id;assert.notEqual(newer,target);
 await role(editor);await denied(rpc,[target,record.entry_key,record.record_hash,rejected,randomUUID(),'accept',''],'40001');
 const historical=await one('select * from academy.knowledge_records where entry_key=$1',['news:'+target]);assert.equal(historical.is_current,false);
 assert.ok(!(await search(p.slug,'material')).items.some(r=>r.package_id===target));assert.ok((await search(p.slug,'material',1,true)).items.some(r=>r.package_id===target));
 assert.equal((await db.query('select * from academy.knowledge_context_decisions where package_id=$1',[newer])).rowCount,0,'No implicit carry-forward to revised article');
 await role('postgres');await db.query('rollback');console.log('PASS KB: privacy/RLS, reader/editor permissions, literal paginated search, preserved rejections, rule rationale, exact replay, stale source/package/decision gates, immutable snapshots, no publication/science/job side effects. All fixtures rolled back.');
}catch(error){await db.query('rollback').catch(()=>{});throw error;}finally{await db.end();}
