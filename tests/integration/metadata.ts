/** Deterministic SCI-002 vertical demonstration; fixed local DB, all writes rolled back. */
import pg from 'pg';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {parsePrimaryMetadata,prepareReviewImport,parseExternalReview} from '@science/sources';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'});
const aid='arxiv:9910.00001',did='doi:10.9999/sci002-fixture';
const xml=await readFile('tests/fixtures/metadata/arxiv.xml','utf8'),json=await readFile('tests/fixtures/metadata/crossref.json','utf8');
const actor=randomUUID(),reviewer=randomUUID();
async function one(sql:string,args:unknown[]=[]) {return (await db.query(sql,args)).rows[0];}
async function reject(sql:string,args:unknown[],code:string) {
 await db.query('savepoint expected_failure');
 try {await db.query(sql,args);assert.fail('Expected SQL rejection');} catch(e:any) {assert.equal(e.code,code);} finally {await db.query('rollback to savepoint expected_failure');}
}
async function asEditor() {await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);}
async function snapshot(identity:string,raw:string) {
 await db.query('reset role');await db.query("update academy.feed_locks set token=null,expires_at=null,next_allowed_at=now()-interval '1 second'");
 await db.query('set local role service_role');
 const token=(await one('select academy.claim_metadata($1) as token',[identity])).token;
 assert.ok(token);if(identity.startsWith('arxiv:')) assert.equal((await one("select academy.claim_feed('arxiv-ai') as lease")).lease,null,'Metadata shares the feed provider lock');
 const normalized=parsePrimaryMetadata(identity,raw);
 const saved=(await one('select academy.finish_metadata($1,$2,200,$3,$4) as id',[identity,token,raw,normalized])).id;
 await asEditor();return saved as string;
}
try {
 await db.connect();await db.query('begin');
 const key=(await one("select encode(secret,'hex') as key from academy.review_import_signing_key where id")).key;
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[actor,actor+'@sci002.test',reviewer,reviewer+'@sci002.test']);
 await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",[actor,reviewer]);
 const scientificBefore=(await one('select count(*) from academy.claims')).count;
 await asEditor();
 const md='# 1. Fundamental physics: Synthetic quantum experiment\n## What changed\nSynthetic review only.\nhttps://arxiv.org/abs/9910.00001\nEvent: initial_preprint\nEvent: initial_preprint\n';
 const parsed=parseExternalReview(md);assert.equal(parsed.candidates[0].events.filter(e=>e.kind==='initial_preprint'&&e.revision===null&&e.date===null).length,2);
 const request=prepareReviewImport(md,'external_review',actor,[{key:'section-1',identity:aid}],key);
 const importReview=async(r:ReturnType<typeof prepareReviewImport>)=>(await one('select academy.import_external_review($1,$2,$3,$4,$5) as id',[r.p_markdown,r.p_source_type,r.p_parser_version,r.p_items,r.p_attestation])).id;
 const review=await importReview(request);assert.equal(await importReview(request),review);
 const item=(await one('select id,story_id from academy.external_review_items where review_id=$1',[review]));
 const originalEvents=(await db.query('select id from academy.scientific_events where review_item_id=$1 order by id',[item.id])).rows.map(r=>r.id);
 assert.equal(originalEvents.length,2,'Distinct undated same-kind events within one item retain separate UUIDs');
 const originalObservations=(await db.query('select * from academy.review_event_observations where item_id=$1 order by ordinal',[item.id])).rows;
 assert.equal(originalObservations.length,2);assert.equal((await one('select count(distinct legacy_event_id) as n from academy.review_event_observations where item_id=$1',[item.id])).n,'2');
 const a=await snapshot(aid,xml);assert.equal(await snapshot(aid,xml),a,'Exact repeated provider response reuses snapshot');
 const d=await snapshot(did,json);
 assert.equal((await one('select count(*) from academy.metadata_snapshots where identity=$1',[aid])).count,'1');
 const prop=(await one('select academy.propose_identity($1,$2) as id',[a,d])).id;
 const linkCommand=randomUUID(),reason='Checked exact arXiv DOI and matching primary bibliographic records.';
 const link=await one('select academy.confirm_identity($1,$2,$3) as result',[prop,reason,linkCommand]);assert.equal(link.result.outcome,'confirmed');
 assert.deepEqual((await one('select academy.confirm_identity($1,$2,$3) as result',[prop,reason,linkCommand])).result,link.result);
 assert.equal((await one('select count(distinct source_id) as n from academy.source_aliases where alias=any($1)',[[aid,did]])).n,'1');
 await reject('select academy.confirm_identity($1,$2,$3)',[prop,'Different reason for same command.',linkCommand],'22023');
 const pendingMarkdown='# 1. Fundamental physics: Source not identified\n## What changed\nSynthetic pending research candidate.\nEvent: initial_preprint\n';
 const pendingRequest=prepareReviewImport(pendingMarkdown,'external_review',actor,[{key:'section-1',identity:null}],key);
 const pendingReview=await importReview(pendingRequest);const pending=(await one('select * from academy.external_review_items where review_id=$1',[pendingReview]));
 const resolutionCommand=randomUUID();
 const resolve=()=>one('select academy.resolve_pending($1,$2,0,$3,$4) as id',[pending.id,a,'Primary arXiv record reviewed against original report.',resolutionCommand]);
 const resolution=(await resolve()).id;assert.equal((await resolve()).id,resolution);
 assert.equal((await one('select story_id from academy.pending_resolutions where id=$1',[resolution])).story_id,item.story_id);
 assert.deepEqual(await one('select * from academy.external_review_items where id=$1',[pending.id]),pending,'Immutable pending original remains byte-for-byte unchanged');
 await reject('select academy.resolve_pending($1,$2,0,$3,$4)',[pending.id,a,'Stale browser submission must not overwrite prior resolution.',randomUUID()],'40001');
 const second=(await one('select academy.resolve_pending($1,$2,1,$3,$4) as id',[pending.id,a,'Second reviewed resolution retains append-only prior lineage.',randomUUID()])).id;
 assert.equal((await one('select previous_id from academy.pending_resolutions where id=$1',[second])).previous_id,resolution);
 const pendingObs=(await one('select id from academy.review_event_observations where item_id=$1',[pending.id])).id;
 const obs=[...originalObservations.map(o=>o.id),pendingObs];const expected=Object.fromEntries(obs.map(id=>[id,0]));
 const eventCommand=randomUUID(),eventReason='Reviewed all observations against the same primary initial publication event.';
 // Published state is a guard: metadata/event links must never change conclusions, status or version.
 await db.query('reset role');await db.query("update academy.stories set status='published' where id=$1",[item.story_id]);await asEditor();
 const beforeStory=await one('select status,editorial_version from academy.stories where id=$1',[item.story_id]);
 const reconcile=()=>one('select academy.reconcile_events($1,$2,$3,$4,$5,$6,$7) as id',[obs,a,'initial_preprint','initialPublished',expected,eventReason,eventCommand]);
 const event=(await reconcile()).id;assert.equal((await reconcile()).id,event);
 assert.equal((await one('select count(*) from academy.event_reconciliations where event_id=$1',[event])).count,'3');
 assert.deepEqual((await db.query('select id from academy.scientific_events where review_item_id=$1 order by id',[item.id])).rows.map(r=>r.id),originalEvents);
 assert.deepEqual(await one('select status,editorial_version from academy.stories where id=$1',[item.story_id]),beforeStory);
 assert.equal((await one('select count(*) from academy.claims')).count,scientificBefore);
 await reject('select academy.reconcile_events($1,$2,$3,$4,$5,$6,$7)',[obs,a,'initial_preprint','initialPublished',expected,eventReason,randomUUID()],'40001');
 await reject('select academy.reconcile_events($1,$2,$3,$4,$5,$6,$7)',[obs.slice(0,1),a,'initial_preprint','initialPublished',expected,eventReason,eventCommand],'22023');
 // Explicit DOI relation with two existing Sources remains unresolved; never merge by title.
 const aid2='arxiv:9910.00002',did2='doi:10.9999/sci002-conflict';
 await db.query("select academy.create_candidate($1,'Identical title is insufficient','physics')",[aid2]);
 await db.query("select academy.create_candidate($1,'Identical title is insufficient','physics')",[did2]);
 const a2=await snapshot(aid2,xml.replaceAll('9910.00001','9910.00002').replaceAll('sci002-fixture','sci002-conflict'));
 const d2=await snapshot(did2,json.replaceAll('SCI002-Fixture','sci002-conflict'));
 const p2=(await one('select academy.propose_identity($1,$2) as id',[a2,d2])).id;
 assert.equal((await one('select academy.confirm_identity($1,$2,$3) as result',[p2,'Two existing sources conflict; retain both until reviewed separately.',randomUUID()])).result.outcome,'conflict');
 assert.equal((await one('select count(distinct source_id) as n from academy.source_aliases where alias=any($1)',[[aid2,did2]])).n,'2');
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[reviewer]);
 assert.ok((await db.query('select id from academy.metadata_snapshots where id=$1',[a])).rowCount);
 await reject('select academy.resolve_pending($1,$2,2,$3,$4)',[pending.id,a,'Reviewer cannot change persisted identity.',randomUUID()],'42501');
 await reject('select academy.request_metadata($1)',[aid],'42501');
 await asEditor();
 assert.equal((await one('select academy.request_metadata($1) as id',[aid])).id,(await one('select academy.request_metadata($1) as id',[aid])).id,'Request is idempotent within UTC day');
 await mkdir('artifacts/metadata',{recursive:true});
 await writeFile('artifacts/metadata/demonstration.json',JSON.stringify({mode:'offline fixtures; rollback only',arxivSnapshot:a,crossrefSnapshot:d,confirmedRelationship:link.result.outcome,pendingResolution:resolution,conflict:'two sources retained',repeatEnrichment:'one snapshot',sameItemUndatedObservations:originalEvents.length,reconciledObservations:3,originalEventsPreserved:true,scientificClaims:'unchanged and unverified',paidCalls:0},null,2));
 console.log('PASS: arXiv/Crossref immutable snapshots, repeated enrichment/import, human identity confirmation, unresolved conflict, pending resolution/revisions, same-item undated events, reviewed reconciliation, published guard, reviewer denial; rolled back');
} finally {await db.query('rollback').catch(()=>{});await db.end();}
