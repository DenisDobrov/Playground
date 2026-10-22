/** Local-only, actual concurrent PostgreSQL sessions. No provider calls. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const clients=[new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'}),new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'})];
const run=`budget-integration:${randomUUID()}`;
const month=`${4000+Math.floor(Math.random()*4000)}-01-01`;
let configured=false;
try {
  await Promise.all(clients.map(c=>c.connect()));
  assert.equal((await clients[0].query('select count(*)::int as n from academy.budget_periods where month=$1',[month])).rows[0].n,0,'Refuse to adopt an existing budget fixture period');
  await clients[0].query("select academy.budget_configure($1,100,'{\"news_analysis\":100,\"content\":0,\"voice\":0,\"video\":0}',100,0)",[month]);
  configured=true;
  const reserve=(client:pg.Client,key:string)=>client.query("select (academy.budget_reserve($1,$2,'news_analysis',80,null,null,'fixture','1','fixture/1',repeat('a',64))).id as id",[key,month]);
  await clients[0].query('begin isolation level repeatable read');
  try { await assert.rejects(reserve(clients[0],`${run}:stale-snapshot`),/BUDGET_ISOLATION_UNSUPPORTED/,'Unsupported stale snapshots fail before reserving money'); }
  finally { await clients[0].query('rollback'); }
  const results=await Promise.allSettled(clients.map((c,i)=>reserve(c,`${run}:${i}`)));
  const accepted=results.filter((r):r is PromiseFulfilledResult<pg.QueryResult>=>r.status==='fulfilled');
  const denied=results.filter((r):r is PromiseRejectedResult=>r.status==='rejected');
  assert.equal(accepted.length,1,'Only one of two concurrent reservations fits the envelope');
  assert.equal(denied.length,1);
  assert.equal(denied[0].reason.message,'BUDGET_LIMIT');
  const id=accepted[0].value.rows[0].id;
  const key=(await clients[0].query('select idempotency_key from academy.budget_operations where id=$1',[id])).rows[0].idempotency_key;
  const duplicate=await Promise.all(clients.map(c=>reserve(c,key)));
  assert.equal(duplicate[0].rows[0].id,duplicate[1].rows[0].id,'Same key keeps one reservation');
  const starts=await Promise.allSettled(clients.map(c=>c.query('select academy.budget_start($1) as token',[id])));
  const dispatched=starts.filter((r):r is PromiseFulfilledResult<pg.QueryResult>=>r.status==='fulfilled');
  assert.equal(dispatched.length,1,'Only one worker can dispatch the provider request');
  const token=dispatched[0].value.rows[0].token;
  await clients[0].query("update academy.budget_operations set expires_at=now()-interval '1 second' where id=$1",[id]);
  await assert.rejects(reserve(clients[1],`${run}:crash`),/BUDGET_LIMIT/,'Crash after dispatch must not free money');
  await clients[1].query('select academy.budget_recover($1)',[month]);
  assert.equal((await clients[0].query('select state from academy.budget_operations where id=$1',[id])).rows[0].state,'uncertain','Crash recovery marks dispatched work for reconciliation');
  assert.equal((await clients[0].query('select reserved_micros from academy.budget_summary where month=$1',[month])).rows[0].reserved_micros,'80');
  await clients[0].query("select academy.budget_settle($1,$2,60,'{\"input_tokens\":10}','receipt:fixture')",[id,token]);
  await clients[1].query("select academy.budget_settle($1,$2,60,'{\"input_tokens\":10}','receipt:fixture')",[id,token]);
  const summary=(await clients[0].query('select spent_micros,reserved_micros from academy.budget_summary where month=$1',[month])).rows[0];
  assert.deepEqual(summary,{spent_micros:'60',reserved_micros:'0'},'Receipt retry accounts once and frees unused reserve');
  console.log('PASS: concurrent reserve and dispatch, key dedupe, crash retains funds, reconciliation and idempotent actual billing');
} finally {
  if(configured) {
    await clients[0].query('delete from academy.budget_events where operation_id in (select id from academy.budget_operations where month=$1)',[month]);
    await clients[0].query('delete from academy.budget_operations where month=$1',[month]);
    await clients[0].query('delete from academy.budget_periods where month=$1',[month]);
  }
  await Promise.all(clients.map(c=>c.end()));
}
