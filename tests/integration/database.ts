/** Explicit integration runner, never picked up by the offline test suite. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Deliberately fixed local target: cannot inherit remote URLs from .env.
const connectionString = 'postgresql://postgres:postgres@127.0.0.1:56322/postgres';
const clients = [new pg.Client({ connectionString }), new pg.Client({ connectionString })];
const keys: string[] = [];
try {
  await Promise.all(clients.map(c => c.connect()));
  const [a, b] = clients;
  const key = `integration:${randomUUID()}`;
  keys.push(key);
  const enqueue = async (db: pg.Client) => (await db.query("select academy.enqueue_job('normalize_source',$1,'{}') as id", [key])).rows[0].id;
  const ids = await Promise.all([enqueue(a), enqueue(b)]);
  assert.equal(ids[0], ids[1], 'Concurrent duplicate enqueue must return one identity');
  const leases = (await Promise.all(clients.map(c => c.query('select * from academy.claim_job()')))).flatMap(r => r.rows);
  const own = leases.filter(job => job.id === ids[0]);
  assert.equal(own.length, 1, 'Only one worker can claim the same job');
  const oldLease = own[0];
  await a.query("update academy.production_jobs set lease_expires_at=now()-interval '1 second' where id=$1", [oldLease.id]);
  const fresh = (await b.query('select * from academy.claim_job()')).rows.find(job => job.id === oldLease.id);
  assert.ok(fresh && fresh.lease_token !== oldLease.lease_token, 'Expired job is reclaimed with a new lease');
  const staleFinish = await a.query("select academy.finish_job($1,$2,'{}') as ok", [oldLease.id, oldLease.lease_token]);
  assert.equal(staleFinish.rows[0].ok, false, 'Stale worker cannot acknowledge new lease');
  assert.equal((await b.query('select academy.renew_job($1,$2) as ok', [fresh.id, fresh.lease_token])).rows[0].ok, true);
  await b.query("select academy.fail_job($1,$2,'RETRY_TEST')", [fresh.id, fresh.lease_token]);
  const retry = (await a.query('select status,available_at>now() as delayed from academy.production_jobs where id=$1', [fresh.id])).rows[0];
  assert.equal(retry.status, 'queued'); assert.equal(retry.delayed, true);
  await a.query("update academy.production_jobs set available_at=now()-interval '1 second' where id=$1", [fresh.id]);
  const third = (await b.query('select * from academy.claim_job()')).rows.find(job => job.id === oldLease.id);
  assert.ok(third);
  await b.query("select academy.fail_job($1,$2,'EXHAUSTED')", [third.id, third.lease_token]);
  assert.equal((await a.query('select status from academy.production_jobs where id=$1', [third.id])).rows[0].status, 'failed');
  console.log('PASS: duplicate enqueue, concurrent claim, recovery, stale lease, renewal, backoff, exhausted attempts');
} finally {
  if (keys.length) await clients[0].query('delete from academy.production_jobs where idempotency_key=any($1)', [keys]).catch(() => {});
  await Promise.all(clients.map(c => c.end()));
}
