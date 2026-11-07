/** Rollback-only synthetic acceptance; never impersonates the real pilot reviewer. */
import pg from 'pg';import {randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {syntheticResearchDraft,researchText} from '../fixtures/research';
import {contentArticleFixture,contentScriptFixture} from '../fixtures/content';
import {contentDraftIssues,type ContentInput} from '@science/core';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'});
const editor=randomUUID(),reviewer=randomUUID(),outsider=randomUUID(),month=`${5000+Math.floor(Math.random()*3000)}-02-01`;
const one=async(s:string,a:unknown[]=[])=> (await db.query(s,a)).rows[0];
async function asUser(id:string){await db.query('reset role');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[id]);}
async function worker(){await db.query('reset role');await db.query('set local role service_role');await db.query("select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true)");}
async function rejects(sql:string,args:unknown[],code:string){await db.query('savepoint expected_error');try{await db.query(sql,args);assert.fail('Expected rejection');}catch(e:any){assert.equal(e.code,code,e.message);}finally{await db.query('rollback to savepoint expected_error');}}
try {
 await db.connect();await db.query('begin');
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[editor,editor+'@content.test',reviewer,reviewer+'@content.test',outsider,outsider+'@content.test']);
 await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",[editor,reviewer]);
 await asUser(editor);const story=(await one("select academy.create_candidate($1,'SCI-004 synthetic content','physics') as id",['arxiv:9911.00001'])).id;
 await db.query('reset role');const snapshot=(await one("insert into academy.metadata_snapshots(identity,provider,adapter_version,raw_payload,payload_hash,normalized) values($1,'arxiv','primary-metadata/1','synthetic',$2,$3) returning id",['arxiv:9911.00001',createHash('sha256').update('synthetic').digest('hex'),{identity:'arxiv:9911.00001',provider:'arxiv',version:1,abstract:'Synthetic abstract.',title:'Synthetic content fixture',bibliographicStatus:'metadata_confirmed',scientificStatus:'unverified'}])).id;
 await asUser(editor);const document=(await one("select academy.save_primary_text($1,$2,'v1','full_text','https://arxiv.org/abs/9911.00001',$3,$4) as id",[snapshot,story,{accessBasis:'Synthetic rollback fixture only',reuseLicense:'unknown',attribution:'Synthetic test'},researchText])).id;
 await worker();const dossier=(await one('select academy.save_agent_dossier($1,$2,0,$3) as id',[document,syntheticResearchDraft(),randomUUID()])).id;
 await asUser(editor);const hash=(await one('select input_hash from academy.dossiers where id=$1',[dossier])).input_hash;
 const prelim=(await one('select academy.create_editorial_brief($1,true,$2) as id',[dossier,hash])).id;
 await rejects('select academy.content_generation_input($1)',[prelim],'22023');
 const claims=(await db.query('select id,local_key from academy.claims where dossier_id=$1',[dossier])).rows;
 for(const c of claims)await one('select academy.review_scientific_claim($1,$2,$3,null,0,0,$4)',[c.id,c.local_key==='supported'?'accept':'reject','Synthetic acceptance: inspect toy model only.',randomUUID()]);
 const state=(await one('select academy.research_review_state($1) as s',[dossier])).s;
 await one('select academy.approve_research_dossier($1,$2,$3,$4,$5)',[dossier,hash,state.reviewIds,'Synthetic whole-dossier acceptance, not real scientific review.',randomUUID()]);
 const brief=(await one('select academy.create_editorial_brief($1,false,$2) as id',[dossier,hash])).id;
 const input:ContentInput=(await one('select academy.content_generation_input($1) as i',[brief])).i;
 assert.equal(input.brief.approvedFindings.length,1);assert.equal(input.independentScientificVerification,'not_performed');
 await worker();await one("select academy.budget_configure($1,1000000,'{\"news_analysis\":0,\"content\":1000000,\"voice\":0,\"video\":0}',1000000,0)",[month]);
 const drafts:{id:string;output_hash:string;input_hash:string}[]=[];
 for(const kind of ['article_es','article_en','script_es'] as const) {
  const payload=kind==='script_es'?contentScriptFixture(input):contentArticleFixture(input,kind==='article_en'?'en':'es');
  assert.deepEqual(contentDraftIssues(kind,payload,input),[]);
  const req=createHash('sha256').update(randomUUID()).digest('hex');
  const op=(await one("select (academy.budget_reserve($1,$2,'content',0,$3,null,$4,'1','synthetic-zero/1',$5)).id as id",[randomUUID(),month,story,'content-'+kind,req])).id;
  const token=(await one('select academy.budget_start($1) as t',[op])).t;
  const response={text:JSON.stringify(payload),finishReason:'STOP',receipt:'synthetic-provider-response',provider:'offline-fixture',usage:{input_tokens:0,output_tokens:0}};
  const audit={requestHash:req,priceVersion:'synthetic-zero/1',model:'offline-fixture',promptVersion:'synthetic-test/1'};
  const receipt=(await one('select academy.record_content_receipt($1,$2,$3,$4,$5,$6) as id',[op,brief,input.inputHash,kind,response,audit])).id;
  await rejects('select academy.save_content_draft($1)',[receipt],'22023');
  await one("select academy.budget_settle($1,$2,0,'{}',$3)",[op,token,'content-receipt:'+receipt]);
  const draft=(await one('select academy.save_content_draft($1) as id',[receipt])).id;assert.equal((await one('select academy.save_content_draft($1) as id',[receipt])).id,draft);
  assert.equal((await one('select academy.record_content_receipt($1,$2,$3,$4,$5,$6) as id',[op,brief,input.inputHash,kind,response,audit])).id,receipt);
  await rejects('select academy.record_content_receipt($1,$2,$3,$4,$5,$6)',[op,brief,input.inputHash,kind,{...response,text:'forged'},audit],'22023');
  const row=await one('select id,output_hash,input_hash,issues from academy.content_drafts where id=$1',[draft]);assert.deepEqual(row.issues,[]);drafts.push(row);
  await rejects('update academy.content_drafts set output_hash=repeat(\'f\',64) where id=$1',[draft],'42501');
 }
 await asUser(outsider);assert.equal((await one('select count(*)::int as n from academy.content_drafts')).n,0);await rejects('select academy.content_generation_input($1)',[brief],'42501');
 await asUser(reviewer);await rejects('select academy.save_content_draft($1)',[randomUUID()],'42501');
 const checks={claimAlignment:true,languageQuality:true,scientificCaveats:true,quantitativeValues:true};
 for(const d of drafts) {
  const args=[d.id,d.output_hash,d.input_hash,'approve',checks,'Synthetic content review, no publication authorized.',0,randomUUID()];
  const id=(await one('select academy.review_content_draft($1,$2,$3,$4,$5,$6,$7,$8) as id',args)).id;
  assert.equal((await one('select academy.review_content_draft($1,$2,$3,$4,$5,$6,$7,$8) as id',args)).id,id);
  await rejects('select academy.review_content_draft($1,$2,$3,$4,$5,$6,$7,$8)',[...args.slice(0,6),0,randomUUID()],'40001');
 }
 await worker();await rejects('select academy.review_content_draft($1,$2,$3,$4,$5,$6,$7,$8)',[drafts[0].id,drafts[0].output_hash,drafts[0].input_hash,'approve',checks,'Service role must not approve.',1,randomUUID()],'42501');
 await asUser(editor);const cl=claims.find(c=>c.local_key==='supported');await one("select academy.review_scientific_claim($1,'narrow',$2,$3,1,0,$4)",[cl.id,'Synthetic narrowing creates a new review input.','Toy-model prediction only.',randomUUID()]);
 await rejects('select academy.content_generation_input($1)',[brief],'40001');
 await rejects('select academy.review_content_draft($1,$2,$3,$4,$5,$6,$7,$8)',[drafts[0].id,drafts[0].output_hash,drafts[0].input_hash,'approve',checks,'Stale package must be rejected.',1,randomUUID()],'40001');
 assert.equal((await one('select count(*)::int as n from academy.articles where story_id=$1 and published_at is not null',[story])).n,0);
 console.log('PASS: approved evidence inputs, ES/EN/script immutable drafts, receipt/ledger replay, scoped human review, stale approvals, RLS, no publication; synthetic fixtures rolled back');
}finally{await db.query('rollback').catch(()=>{});await db.end();}
