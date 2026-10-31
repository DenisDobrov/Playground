/** Synthetic users/claims test the real SQL workflow; all writes rolled back. Never a real human review. */
import pg from 'pg';import {randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {syntheticResearchDraft,researchText} from '../fixtures/research';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'});
const editor=randomUUID(),reviewer=randomUUID(),outsider=randomUUID();
async function one(s:string,a:unknown[]=[]) {return (await db.query(s,a)).rows[0];}
async function asUser(id:string) {await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);}
async function reject(s:string,a:unknown[],code:string) {await db.query('savepoint failure');try {await db.query(s,a);assert.fail('Expected rejection');}catch(e:any){assert.equal(e.code,code);}finally{await db.query('rollback to savepoint failure');}}
try {
 await db.connect();await db.query('begin');
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)',[editor,editor+'@research.test',reviewer,reviewer+'@research.test',outsider,outsider+'@research.test']);
 await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",[editor,reviewer]);
 await asUser(editor);const story=(await one("select academy.create_candidate('arxiv:9912.00001','Synthetic research fixture','physics') as id")).id;
 await db.query('reset role');
 const normalized={identity:'arxiv:9912.00001',provider:'arxiv',version:1,title:'Synthetic research fixture',abstract:'Synthetic abstract only: scope is restricted.',bibliographicStatus:'metadata_confirmed',scientificStatus:'unverified'};
 const snapshot=(await one("insert into academy.metadata_snapshots(identity,provider,adapter_version,raw_payload,payload_hash,normalized) values('arxiv:9912.00001','arxiv','primary-metadata/1','synthetic research fixture',$1,$2) returning id",[createHash('sha256').update('synthetic research fixture').digest('hex'),normalized])).id;
 await asUser(editor);const rights={accessBasis:'Synthetic local fixture only',reuseLicense:'unknown',attribution:'Synthetic fixture'};
 const save=(text=researchText,scope='full_text')=>one("select academy.save_primary_text($1,$2,'v1',$3,'https://arxiv.org/abs/9912.00001',$4,$5) as id",[snapshot,story,scope,rights,text]);
 const document=(await save()).id;assert.equal((await save()).id,document);
 await reject("select academy.save_primary_text($1,$2,'v1','full_text','https://arxiv.org/abs/9912.00001',$3,$4)",[snapshot,story,rights,normalized.abstract],'22023');
 await reject("select academy.save_primary_text($1,$2,'v2','full_text','https://arxiv.org/abs/9912.00001',$3,$4)",[snapshot,story,rights,researchText],'22023');
 await reject("select academy.save_primary_text($1,$2,'v1','abstract_only','https://arxiv.org/abs/9912.00001',$3,'Invented abstract')",[snapshot,story,rights],'22023');
 const draft=syntheticResearchDraft(),command=randomUUID();
 await reject('select academy.save_agent_dossier($1,$2,0,$3)',[document,draft,command],'42501');
 await db.query('set local role service_role');
 const dossier=(await one('select academy.save_agent_dossier($1,$2,0,$3) as id',[document,draft,command])).id;
 assert.equal((await one('select academy.save_agent_dossier($1,$2,0,$3) as id',[document,draft,command])).id,dossier);
 await asUser(editor);const row=await one('select * from academy.dossiers where id=$1',[dossier]);
 const claims=(await db.query('select * from academy.claims where dossier_id=$1',[dossier])).rows;const claim=(key:string)=>claims.find(c=>c.local_key===key).id;
 assert.ok(claims.every(c=>c.status==='unverified'));assert.equal(claims.find(c=>c.local_key==='unsupported').extraction_status,'unsupported');
 const state=()=>one('select academy.research_review_state($1) as state',[dossier]);assert.equal((await state()).state.ready,false);
 await reject('select academy.create_editorial_brief($1,false,$2)',[dossier,row.input_hash],'22023');
 const prelim=(await one('select academy.create_editorial_brief($1,true,$2) as id',[dossier,row.input_hash])).id;assert.equal((await one('select preliminary from academy.editorial_briefs where id=$1',[prelim])).preliminary,true);
 await reject('select academy.review_scientific_claim($1,$2,$3,null,0,1,$4)',[claim('unsupported'),'accept','No evidence exists for this invented numeric claim.',randomUUID()],'22023');
 await reject('select academy.review_scientific_claim($1,$2,$3,null,0,1,$4)',[claim('supported'),'narrow','A narrowing requires an explicit replacement wording.',randomUUID()],'22023');
 await asUser(reviewer);const reviewCommand=randomUUID();const reason='Synthetic reviewer checks theory-only meaning against the exact quoted source.';
 const review=(key:string,decision:string,narrowed:string|null=null,expected=0,cmd=randomUUID())=>one('select academy.review_scientific_claim($1,$2,$3,$4,$5,5,$6) as id',[claim(key),decision,reason,narrowed,expected,cmd]);
 const r1=(await review('supported','narrow','Only this synthetic model predicts a bounded response.',0,reviewCommand)).id;
 assert.equal((await review('supported','narrow','Only this synthetic model predicts a bounded response.',0,reviewCommand)).id,r1);
 await review('misleading','reject');await review('unsupported','reject');
 let s=(await state()).state;assert.equal(s.claimsReady,true);assert.equal(s.ready,false,'Whole dossier/framing approval still required');
 await one('select academy.approve_research_dossier($1,$2,$3,$4,$5) as id',[dossier,row.input_hash,s.reviewIds,'Synthetic human fixture reviews all thirteen sections and editorial planning.',randomUUID()]);
 assert.equal((await state()).state.ready,true);
 await asUser(editor);const brief=(await one('select academy.create_editorial_brief($1,false,$2) as id',[dossier,row.input_hash])).id;
 const b=(await one('select content from academy.editorial_briefs where id=$1',[brief])).content;
 assert.equal(b.approvedFindings.length,1);assert.equal(b.approvedFindings[0].text,'Only this synthetic model predicts a bounded response.');assert.ok(!JSON.stringify(b).includes('99%'));assert.equal(b.independentScientificVerification,'not_performed');assert.equal(b.documentId,document);
 assert.equal((await one('select academy.create_editorial_brief($1,false,$2) as id',[dossier,row.input_hash])).id,brief);
 await asUser(reviewer);await review('supported','request_revision',null,1);assert.equal((await state()).state.ready,false,'Changed review invalidates prior whole-dossier approval');
 await reject('select academy.review_scientific_claim($1,$2,$3,null,0,5,$4)',[claim('supported'),'reject',reason,randomUUID()],'40001');
 await asUser(outsider);assert.equal((await one('select count(*) from academy.primary_documents where id=$1',[document])).count,'0');await reject('select academy.research_review_state($1)',[dossier],'42501');
 await asUser(editor);const bad=structuredClone(draft);bad.evidence[0].page=2;await reject('select academy.save_research_dossier($1,$2,1,$3)',[document,bad,randomUUID()],'22023');
 const doc2=(await save(researchText+' Additional source context.')).id;assert.notEqual(doc2,document);assert.equal((await state()).state.stale,true);
 const humanDossier=(await one('select academy.save_research_dossier($1,$2,1,$3) as id',[doc2,draft,randomUUID()])).id;const humanClaim=(await one('select id from academy.claims where dossier_id=$1 limit 1',[humanDossier])).id;
 await reject('select academy.review_scientific_claim($1,$2,$3,null,0,5,$4)',[humanClaim,'reject',reason,randomUUID()],'42501');
 await db.query('reset role');await reject('update academy.claims set text_en=$1 where id=$2',['Changed source meaning',claim('supported')],'23000');await reject('delete from academy.evidence where dossier_id=$1',[dossier],'23000');
 const badNarrative=structuredClone(draft);badNarrative.sections.mainFindings=[{text:'An experiment was demonstrated.',claimKeys:['misleading'],provenance:'source_supported'}];
 await db.query('set local role service_role');const inconsistent=(await one('select academy.save_agent_dossier($1,$2,2,$3) as id',[doc2,badNarrative,randomUUID()])).id;
 await asUser(reviewer);const badClaims=(await db.query('select * from academy.claims where dossier_id=$1',[inconsistent])).rows;
 for(const c of badClaims) await one('select academy.review_scientific_claim($1,$2,$3,null,0,1,$4) as id',[c.id,c.local_key==='supported'?'accept':'reject','Synthetic semantic review: retain only model prediction.',randomUUID()]);
 const badState=(await one('select academy.research_review_state($1) as state',[inconsistent])).state,badHash=(await one('select input_hash from academy.dossiers where id=$1',[inconsistent])).input_hash;
 await reject('select academy.approve_research_dossier($1,$2,$3,$4,$5)',[inconsistent,badHash,badState.reviewIds,'Cannot approve a narrative that still cites the rejected interpretation.',randomUUID()],'22023');
 assert.ok((await one('select count(*) from academy.claims where dossier_id=$1 and status<>$2',[dossier,'unverified'])).count==='0');
 console.log('PASS: versioned primary text/PDF provenance, literal page/quote checks, unsupported approval block, misleading interpretation rejected by synthetic reviewer, scoped reviewer writes, self-review denial, whole-dossier approval, narrowed brief, stale/replay/new-input gates; rollback only, not a real human review');
} finally {await db.query('rollback').catch(()=>{});await db.end();}
