import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { validateRemoteTarget } from './database-target.mjs';

const target = JSON.parse(await readFile(new URL('../supabase/project.json', import.meta.url), 'utf8'));
const mode = process.argv[2];
if (!['plan', 'apply'].includes(mode)) throw new Error('Use plan or apply');
if (process.env.SUPABASE_PROJECT_REF && process.env.SUPABASE_PROJECT_REF !== target.projectRef) throw new Error('Project ref differs from the approved target');
let connectionString;
try {
  connectionString = validateRemoteTarget(process.env.SUPABASE_DB_URL, target.projectRef);
} catch (error) {
  console.error(JSON.stringify({ event: 'database.not_connected', reason: error.message }));
  process.exit(1);
}
if (mode === 'apply' && !process.argv.includes(`--project-ref=${target.projectRef}`)) throw new Error(`Apply requires --project-ref=${target.projectRef}`);
const ca = process.env.SUPABASE_DB_CA_FILE ? await readFile(process.env.SUPABASE_DB_CA_FILE, 'utf8') : undefined;
const db = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
const files = (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort();
const migrations = await Promise.all(files.map(async name => {
  const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
  return { name, sql, checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex') };
}));

try {
  await db.connect();
  // Plan uses a read-only transaction. Apply is one transaction under an advisory lock.
  await db.query(mode === 'plan' ? 'begin read only' : 'begin');
  if (mode === 'apply') await db.query("select pg_advisory_xact_lock(hashtextextended('dobrov-academy-install',0))");
  const { rows: inventory } = await db.query("select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by 1,2");
  const { rows: storagePolicies } = await db.query("select policyname,roles,cmd,qual,with_check from pg_policies where schemaname='storage' and tablename='objects' order by policyname");
  const { rows: flags } = await db.query("select to_regnamespace('academy') is not null as schema_exists, to_regclass('academy.install_migrations') is not null as journal_exists");
  if (flags[0].schema_exists && !flags[0].journal_exists) throw new Error('academy schema already exists without our installation journal; review it before adopting');
  const { rows: bucket } = await db.query('select id,public from storage.buckets where id=$1', [target.bucket]);
  if (bucket.length && !flags[0].journal_exists) throw new Error('Storage bucket already exists; refusing to adopt it');
  if (bucket.some(b => b.public)) throw new Error('Academy bucket is public; stop and review existing configuration');
  const applied = flags[0].journal_exists ? (await db.query('select version,checksum from academy.install_migrations')).rows : [];
  for (const entry of applied) {
    const file = migrations.find(m => m.name === entry.version);
    if (!file || file.checksum !== entry.checksum) throw new Error('Applied migration differs from this checkout; stop and review history');
  }
  const pending = migrations.filter(m => !applied.some(a => a.version === m.name));
  const report = { projectRef: target.projectRef, mode, schema: target.schema, legacyTables: inventory.filter(t => t.schemaname !== 'academy'), storagePolicies, pending: pending.map(m => m.name), legacyDataRowsRead: 0 };
  if (mode === 'apply') {
    if (storagePolicies.length) throw new Error('Existing storage policies require review before adding a private Academy bucket');
    // Snapshot structural metadata only; no legacy rows, passwords, Auth configuration or project-wide settings are changed.
    await mkdir('artifacts/database', { recursive: true });
    await writeFile(`artifacts/database/preflight-${Date.now()}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
    for (const migration of pending) {
      await db.query(migration.sql);
      await db.query('create table if not exists academy.install_migrations(version text primary key,checksum text not null,installed_at timestamptz not null default now())');
      await db.query('revoke all on academy.install_migrations from public,anon,authenticated');
      await db.query('insert into academy.install_migrations(version,checksum) values($1,$2)', [migration.name, migration.checksum]);
    }
    const { rows: after } = await db.query("select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema','academy') order by 1,2");
    if (JSON.stringify(after) !== JSON.stringify(report.legacyTables)) throw new Error('Unexpected changes outside academy; rolling back');
  }
  await db.query('commit');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await db.query('rollback').catch(() => {});
  // Never echo raw connection errors that can include connection strings or credentials.
  console.error(JSON.stringify({ event: 'database.stopped', reason: error instanceof Error && /Set SUPABASE|already exists|migration differs|Unexpected changes|storage policies require/.test(error.message) ? error.message : 'Database operation failed; check connection, verified TLS and privileges locally.', code: error?.code ?? 'PREFLIGHT_FAILED' }));
  process.exitCode = 1;
} finally {
  await db.end();
}
