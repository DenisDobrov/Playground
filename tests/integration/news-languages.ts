/** Local-only NEWS-003 acceptance. Synthetic users, DDL and fixtures all roll back. */
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {newsFixture} from '../fixtures/news';
import {newsPackageSchema,type NewsPackage} from '../../packages/core/src/news';

// Never consult environment credentials: this suite must not reach a shared cloud DB.
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres',connectionTimeoutMillis:5000});
const editor=randomUUID(),reader=randomUUID(),outsider=randomUUID();
const languages=['en','es','ru','zh-Hans'] as const;
const headings={en:'Why it matters',es:'Por qué importa',ru:'Почему это важно','zh-Hans':'为什么重要'};
const decide='select academy.news_decide($1,$2,$3,$4,$5,$6,$7) as id';
let connected=false,transactionOpen=false;
let batchId:string;
const one=async(sql:string,args:unknown[]=[]) => (await db.query(sql,args)).rows[0];
async function role(value:'service_role'|'anon'|'postgres'|string){
  await db.query('reset role');
  if(value==='postgres')return;
  if(value==='service_role'||value==='anon'){await db.query(`set local role ${value}`);return;}
  await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[value]);
}
async function denied(sql:string,args:unknown[],expected?:string){
  await db.query('savepoint expected_denial');
  let error:unknown;
  try{await db.query(sql,args);}catch(e){error=e;}finally{await db.query('rollback to savepoint expected_denial');}
  assert.ok(error,'Operation must fail');
  if(expected){const e=error as {code?:string;message?:string};assert.ok(e.code===expected||e.message?.includes(expected),`Expected ${expected}; received ${e.code}: ${e.message}`);}
  await db.query('release savepoint expected_denial');
}
function unique(content:NewsPackage){
  const value=structuredClone(content),id=randomUUID();
  value.slug='synthetic-languages-'+id;value.eventKey='synthetic-languages:'+id;
  return value;
}
function fourLanguageFixture(sourceHash:string):NewsPackage{
  const value=unique(newsFixture(sourceHash));
  value.period='2026-11-07/2026-11-14';
  const paragraphs={en:['Synthetic fixture only. No scientific result.','This checks a language release. It supplies no research conclusion.'],es:['Solo una prueba sintética. No es un resultado científico.','Comprueba una publicación por idioma. No aporta una conclusión científica.'],ru:['Только синтетическая проверка. Научных результатов нет.','Проверяется выпуск языковой версии. Научный вывод не формируется.'],'zh-Hans':['仅为合成测试，不是科学结果。','用于检查语言发布。没有提出科学结论。']};
  const titles={en:'Synthetic four-language release',es:'Publicación sintética en cuatro idiomas',ru:'Синтетический выпуск на четырёх языках','zh-Hans':'四语言合成发布测试'};
  for(const language of languages){
    value[language]={title:titles[language],paragraphs:paragraphs[language],limitations:'Synthetic integration fixture; no clinical or scientific claim.',blocks:[{type:'paragraph',text:paragraphs[language][0]},{type:'heading',text:headings[language]},{type:'paragraph',text:paragraphs[language][1]}]};
  }
  value.research={version:'news-003/1',eventDates:[{kind:'news_event',date:'2026-11-14',source:value.sources[0].url,notes:'Synthetic event, not a real publication.'}],dossier:{summaryEn:'Private synthetic dossier.',claims:[{id:'fixture-claim',textEn:'This package is a synthetic fixture.',type:'editorial_explanation',source:value.sources[0].url,locator:'Synthetic fixture paragraph1',quantity:null,unit:null,object:'test package',conditions:'local rollback transaction',comparator:null,sample:null,uncertainty:null,limitations:'Not a scientific assertion.'}],authorValidation:'Not applicable to synthetic fixture.',externalVerification:'Not performed.',independent_verification:'not_performed'},sourceReview:{status:'checked',method:'agent_source_meaning_check',findings:'Synthetic source check only.',checkedAt:'2026-11-14T12:00:00Z'},editorialBrief:{angle:'Verify scoped release behavior.',audience:'Test runner',keyMessage:'Synthetic only.',importance:'Check the contract.',limitations:'No real publication.'},languageChecks:languages.map(language=>({language,status:'checked',method:'agent_consistency_check',notes:'Synthetic matching fixture.'})),humanReview:'pending_exact_package_decision'};
  return newsPackageSchema.parse(value);
}
async function importPackage(content:NewsPackage){
  await role('service_role');
  return (await one('select academy.news_import($1,null,$2) as id',[batchId,content])).id as string;
}
async function approve(packageId:string,request=randomUUID()){
  await role(editor);
  const state=await one('select version from academy.news_state where package_id=$1',[packageId]);
  return {id:(await one(decide,[packageId,state.version,request,'approve','',false,false])).id as string,version:state.version,request};
}
async function releaseCount(packageId:string){return Number((await one('select count(*) as count from academy.news_releases where package_id=$1',[packageId])).count);}
async function immutableSnapshot(packageId:string){
  await role('postgres');
  return {package:(await one('select to_jsonb(p) as value from academy.news_packages p where id=$1',[packageId])).value,decisions:(await db.query('select to_jsonb(d) as value from academy.news_decisions d where package_id=$1 order by id',[packageId])).rows,releases:(await db.query('select to_jsonb(r) as value from academy.news_releases r where package_id=$1 order by language',[packageId])).rows};
}
async function rejectsRelease(base:NewsPackage,mutate:(p:NewsPackage)=>void,expected:string){
  // Deliberately bypass the TS validator to test the server gate against malformed imports.
  const content=unique(base);mutate(content);const packageId=await importPackage(content);
  await role(editor);const before=await one('select * from academy.news_state where package_id=$1',[packageId]);
  await denied(decide,[packageId,before.version,randomUUID(),'approve','',false,false],expected);
  assert.deepEqual(await one('select * from academy.news_state where package_id=$1',[packageId]),before,'Rejected approval cannot alter state');
  assert.equal(await releaseCount(packageId),0);
  assert.equal(Number((await one('select count(*) as count from academy.news_decisions where package_id=$1',[packageId])).count),0);
  assert.equal(Number((await one('select count(*) as count from academy.news_outbox where package_id=$1',[packageId])).count),0);
}

try{
  await db.connect();connected=true;await db.query('begin');transactionOpen=true;
  await db.query("set local lock_timeout='5s'; set local statement_timeout='30s'");
  const existed=Boolean((await one("select to_regclass('academy.news_batches') as value")).value);
  if(!existed)await db.query(await readFile('supabase/migrations/202611070015_news_release.sql','utf8'));
  // Never apply SCI-004/013, reset a database, or alter installed migration history.
  const migrationHistory=await one("select case when to_regclass('supabase_migrations.schema_migrations') is null then false else true end as exists");
  const installedVersions=migrationHistory.exists?(await db.query('select version from supabase_migrations.schema_migrations order by version')).rows:[];
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[editor,editor+'@languages.test',reader,reader+'@languages.test',outsider,outsider+'@languages.test']);
  // The existing reviewer is the read-only viewer; no production role/account is added.
  await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",[editor,reader]);
  const source='Synthetic NEWS-003 rollback acceptance '+randomUUID(),sourceHash=createHash('sha256').update(source).digest('hex');
  batchId=(await one("insert into academy.news_batches(source_text,period_start,period_end,owner_authorization) values($1,'2026-11-07','2026-11-14',$2) returning id",[source,{instructionHash:'d'.repeat(64),ownerId:editor,policy:'news-release/1'}])).id;

  // A real legacy-shaped two-language snapshot exists before the scoped DDL rehearsal.
  const legacy=unique(newsFixture(sourceHash));const legacyId=await importPackage(legacy);
  await approve(legacyId);assert.equal(await releaseCount(legacyId),2);
  const beforeMigration=await immutableSnapshot(legacyId);
  const sql=await readFile('supabase/migrations/202611140016_news_languages.sql','utf8');
  // Rehearse current file even if this helper is already installed, entirely inside rollback.
  await db.query(sql.replace('create function academy.news_validate_languages(','create or replace function academy.news_validate_languages('));
  assert.deepEqual(await immutableSnapshot(legacyId),beforeMigration,'Migration must not rewrite legacy package/decision/release history');
  if(migrationHistory.exists)assert.deepEqual((await db.query('select version from supabase_migrations.schema_migrations order by version')).rows,installedVersions);

  const content=fourLanguageFixture(sourceHash),packageId=await importPackage(content);
  assert.equal(await importPackage(content),packageId,'Exact import is idempotent');
  await role('anon');assert.equal(await releaseCount(packageId),0,'Draft must not be public');
  for(const table of ['news_packages','news_state','news_decisions','news_batches','news_outbox'])await denied(`select * from academy.${table}`,[],'42501');
  await role(reader);assert.equal(Number((await one('select count(*) as count from academy.news_packages where id=$1',[packageId])).count),1);
  await denied(decide,[packageId,0,randomUUID(),'approve','',false,false],'42501');
  await denied('select academy.news_validate_languages($1)',[content],'42501');
  await denied('select academy.news_import($1,null,$2)',[batchId,content],'42501');
  await role(outsider);assert.equal(Number((await one('select count(*) as count from academy.news_packages where id=$1',[packageId])).count),0);
  await denied(decide,[packageId,0,randomUUID(),'approve','',false,false],'42501');

  const decision=await approve(packageId);
  assert.equal((await one(decide,[packageId,decision.version,decision.request,'approve','',false,false])).id,decision.id,'Decision replay must be idempotent');
  const releases=(await db.query('select language,decision_id,content from academy.news_releases where package_id=$1 order by language',[packageId])).rows;
  assert.deepEqual(releases.map(r=>r.language),[...languages].sort());
  assert.equal(releases.length,4);assert.ok(releases.every(r=>r.decision_id===decision.id));
  assert.equal(Number((await one('select count(*) as count from academy.news_decisions where package_id=$1',[packageId])).count),1,'One owner decision releases all four exact translations');
  for(const release of releases){
    assert.deepEqual(release.content.article,content[release.language as typeof languages[number]]);
    assert.deepEqual(release.content.eventDates,content.research!.eventDates);
    for(const key of ['research','dossier','sourceReview','languageChecks','editorialBrief','humanReview','provenance','suggestions','channelTexts','campaign'])assert.equal(release.content[key],undefined,`Private ${key} must not be public`);
  }
  await role('anon');assert.equal(await releaseCount(packageId),4);assert.equal(await releaseCount(legacyId),2);
  await role(reader);await denied('insert into academy.news_releases(package_id,decision_id,story_id,language,slug,content) select package_id,decision_id,story_id,language,slug,content from academy.news_releases where package_id=$1 limit 1',[packageId],'42501');
  await denied('select academy.news_claim_delivery($1)',[randomUUID()],'42501');

  await rejectsRelease(content,p=>{p.research!.languageChecks.find(c=>c.language==='ru')!.status='blocked';},'NEWS_LANGUAGE_CHECK_REQUIRED');
  await rejectsRelease(content,p=>{p.research!.sourceReview.status='blocked';},'NEWS_SOURCE_CHECK_REQUIRED');
  await rejectsRelease(content,p=>{p.verification.status='blocked';},'NEWS_SOURCE_CHECK_REQUIRED');
  await rejectsRelease(content,p=>{p['zh-Hans']!.blocks=p['zh-Hans']!.blocks!.filter(b=>b.type!=='heading');},'NEWS_IMPORTANCE_REQUIRED');
  await rejectsRelease(content,p=>{p.research!.languageChecks=p.research!.languageChecks.filter(c=>c.language!=='es');},'NEWS_LANGUAGE_CHECK_REQUIRED');
  await rejectsRelease(content,p=>{p.research!.languageChecks.push({...p.research!.languageChecks.find(c=>c.language==='ru')!,status:'blocked'});},'NEWS_LANGUAGE_CHECK_REQUIRED');
  await rejectsRelease(content,p=>{(p as unknown as {period:null}).period=null;},'NEWS_PERIOD_REQUIRED');

  // A future-dated release row is invisible to anon even though it exists in storage.
  const futureId=await importPackage(unique(content));await role('postgres');
  const futurePackage=await one('select * from academy.news_packages where id=$1',[futureId]);
  const futureDecision=(await one("insert into academy.news_decisions(package_id,actor_id,decision,comment,suggested_video,suggested_science,request_id,expected_version,package_hash,origin) values($1,$2,'approve','synthetic scheduled fixture',false,false,$3,0,$4,'editor_ui') returning id",[futureId,editor,randomUUID(),futurePackage.package_hash])).id;
  await db.query("insert into academy.news_releases(package_id,decision_id,story_id,language,slug,content,published_at) values($1,$2,$3,'en',$4,$5,now()+interval '1 day')",[futureId,futureDecision,futurePackage.story_id,futurePackage.slug,{article:content.en}]);
  await role('anon');assert.equal(await releaseCount(futureId),0,'Anon must see only published rows');

  // Delivery must accept four exact releases and remain compatible with legacy two.
  await role('postgres');
  const jobs=(await db.query('select id,package_id from academy.news_outbox where package_id=any($1) order by id',[[packageId,legacyId]])).rows;
  for(const id of [packageId,legacyId]){
    const job=jobs.find(j=>j.package_id===id)!;assert.ok(job);
    await role('postgres');await db.query("update academy.news_outbox set state='pending',error_code=null where id=$1",[job.id]);
    await role('service_role');const claimed=await one('select * from academy.news_claim_delivery($1)',[job.id]);
    assert.equal(claimed.state,'sending');assert.ok(claimed.lease_token);
    assert.equal((await one('select academy.news_claim_delivery($1) is null as empty',[job.id])).empty,true);
  }
  // Synthetic interrupted/partial state: only EN/ES of a four-language package exists.
  // No immutable row is deleted or trigger disabled to manufacture this case.
  const partialId=await importPackage(unique(content));await role('postgres');
  const partial=await one('select * from academy.news_packages where id=$1',[partialId]);
  const partialDecision=(await one("insert into academy.news_decisions(package_id,actor_id,decision,comment,suggested_video,suggested_science,request_id,expected_version,package_hash,origin) values($1,$2,'approve','synthetic partial delivery fixture',false,false,$3,0,$4,'editor_ui') returning id",[partialId,editor,randomUUID(),partial.package_hash])).id;
  await db.query("update academy.news_state set decision='approve',version=1 where package_id=$1",[partialId]);
  for(const language of ['en','es'])await db.query('insert into academy.news_releases(package_id,decision_id,story_id,language,slug,content) values($1,$2,$3,$4,$5,$6)',[partialId,partialDecision,partial.story_id,language,partial.slug,{article:content[language as 'en'|'es']}]);
  const partialJob=(await one("insert into academy.news_outbox(package_id,decision_id,channel,language,payload,state) values($1,$2,'telegram','bilingual',$3,'pending') returning id",[partialId,partialDecision,content.channelTexts.telegram])).id;
  await role('service_role');assert.equal((await one('select academy.news_claim_delivery($1) is null as empty',[partialJob])).empty,true,'Two releases are insufficient for four present translations');
  assert.equal((await one('select state from academy.news_outbox where id=$1',[partialJob])).state,'cancelled');

  const beforeRevision=await immutableSnapshot(packageId);
  await denied('update academy.news_packages set content=$1 where id=$2',[content,packageId],'NEWS_IMMUTABLE_REVISION');
  await denied('delete from academy.news_releases where package_id=$1',[packageId],'NEWS_IMMUTABLE_REVISION');
  const revision=structuredClone(content);revision.ru!.title+=' revision';
  const revisedId=await importPackage(revision);assert.notEqual(revisedId,packageId);
  const revisedState=await one('select * from academy.news_state where package_id=$1',[revisedId]);assert.equal(revisedState.decision,null);assert.equal(await releaseCount(revisedId),0);
  await role(editor);await denied(decide,[packageId,revisedState.version,randomUUID(),'approve','',false,false],'40001');
  assert.deepEqual(await immutableSnapshot(packageId),beforeRevision,'New revision must preserve old exact snapshots and decisions');
  assert.deepEqual(await immutableSnapshot(legacyId),beforeMigration,'Legacy snapshots remain unchanged throughout acceptance');

  await db.query('rollback');transactionOpen=false;
  assert.equal(Number((await one('select count(*) as count from auth.users where id=any($1)',[[editor,reader,outsider]])).count),0,'Synthetic users must roll back');
  assert.equal(Boolean((await one("select to_regclass('academy.news_batches') as value")).value),existed,'Rehearsed schema must roll back');
  if(existed)assert.equal(Number((await one('select count(*) as count from academy.news_batches where id=$1',[batchId])).count),0,'Synthetic batch must roll back');
  console.log('PASS NEWS-003 local: one owner decision/four translations, legacy two releases, blocked source/language/importance gates, anon published-only/private exclusion, read-only reviewer, immutable history, dynamic delivery coverage and complete rollback. No cloud DB or migration013 used.');
}finally{
  if(connected&&transactionOpen)await db.query('rollback').catch(()=>{});
  if(connected)await db.end();
}
