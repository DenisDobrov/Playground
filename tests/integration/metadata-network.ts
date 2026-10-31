/** Opt-in, at most one request per approved provider. No source/story writes or paid calls. */
import pg from 'pg';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fetchPrimaryMetadata,parsePrimaryMetadata,metadataHash} from '@science/sources';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'});
const report:Record<string,unknown>[]=[];
try {
 await db.connect();
 for(const identity of ['arxiv:1706.03762','doi:10.1038/s41586-021-03819-2']) {
  const {rows}=await db.query('select academy.claim_metadata($1) as token',[identity]);const token=rows[0].token;
  if(!token) {report.push({identity,result:'deferred_shared_cooldown'});continue;}
  let status=0,delay=60;
  try {
   const response=await fetchPrimaryMetadata(identity);status=response.status;delay=response.retryAfterSeconds;
   assert.equal(status,200,'Approved endpoint must return metadata');
   const normalized=parsePrimaryMetadata(identity,response.text);assert.equal(normalized.identity,identity);assert.equal(normalized.scientificStatus,'unverified');
   report.push({identity,endpoint:response.url,result:'metadata_received',title:normalized.title,hash:metadataHash(response.text),retrievedAt:new Date().toISOString(),scientificStatus:normalized.scientificStatus});
  } catch(e) {report.push({identity,result:'unavailable',status,error:e instanceof Error?e.message:'Unknown transport error'});process.exitCode=1;}
  finally {
   // Smoke does not persist provider content or enrich the real editorial pool. Preserve cooldown only.
   const provider=identity.startsWith('arxiv:')?'arxiv':'crossref';
   await db.query("update academy.feed_locks set token=null,expires_at=null,next_allowed_at=greatest(next_allowed_at,now()+make_interval(secs=>$3)) where provider=$1 and token=$2",[provider,token,[429,503].includes(status)?delay:status===200?3:60]);
  }
 }
 await mkdir('artifacts/metadata',{recursive:true});await writeFile('artifacts/metadata/network-smoke.json',JSON.stringify({report,paidCalls:0,sourceWrites:0},null,2));
 console.log(JSON.stringify({event:'metadata.network_smoke',report,paidCalls:0}));
} finally {await db.end();}
