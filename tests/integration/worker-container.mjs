// Linux container-only transport fixture. Not production lifecycle evidence.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
const calls=[];
let mode='success';
let claimed=false;
const job={id:'00000000-0000-4000-8000-000000000001',story_id:null,stage:'normalize_source',attempts:1,lease_token:'synthetic-lease',payload:{identifier:'doi:10.9999/academy-prod002-worker-acceptance'}};
const server=createServer((req,res)=>{
  calls.push(req.url);
  res.setHeader('Content-Type','application/json');
  if(req.url==='/rest/v1/rpc/claim_worker_acceptance_job') {
    if(mode==='error') {res.writeHead(400);res.end(JSON.stringify({code:'PGRST202',message:'Synthetic missing RPC'}));return;}
    res.end(JSON.stringify(claimed?[]:[job]));claimed=true;
  } else if(['/rest/v1/rpc/renew_job','/rest/v1/rpc/finish_job'].includes(req.url)) res.end('true');
  else {res.writeHead(400);res.end('{"code":"UNEXPECTED_RPC"}');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const env={...process.env,SUPABASE_URL:`http://127.0.0.1:${server.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'synthetic-container-key',SUPABASE_DB_SCHEMA:'academy'};
const run=()=>new Promise((resolve,reject)=>{
  const child=spawn('timeout',['--signal=TERM','--kill-after=10s','240s','env','WORKER_QUEUE_MODE=acceptance','npm','run','worker:once'],{env});
  let output='';child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
  child.once('error',reject);child.once('exit',code=>resolve({code,output}));
});
try {
  const first=await run();assert.equal(first.code,0);assert.match(first.output,/job.claimed/);assert.match(first.output,/job.lease_renewed/);assert.match(first.output,/job.succeeded/);
  const second=await run();assert.equal(second.code,0);assert.match(second.output,/worker.idle/);
  mode='error';const failed=await run();assert.equal(failed.code,1);assert.match(failed.output,/worker.failed/);
  assert.equal(calls.filter(p=>p==='/rest/v1/rpc/claim_worker_acceptance_job').length,3);
  assert.equal(calls.filter(p=>p==='/rest/v1/rpc/renew_job').length,1);
  assert.equal(calls.filter(p=>p==='/rest/v1/rpc/finish_job').length,1);
  assert.ok(!calls.includes('/rest/v1/rpc/claim_job'));
  for(const result of [first,second,failed]) {assert.ok(!result.output.includes('synthetic-container-key'));assert.ok(!result.output.includes('synthetic-lease'));}
  console.log('PASS: container command, scoped claim, renewal, finish, repeated idle, fail-closed RPC error; synthetic HTTP transport only');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
