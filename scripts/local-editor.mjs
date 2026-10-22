import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const email = (process.argv[2] || '').trim().toLowerCase();
const role = process.argv[3] || 'editor';
if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) || !['editor', 'reviewer'].includes(role)) throw new Error('Usage: npm run web:local:editor -- email [editor|reviewer]');
const statusCommand = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', windowsHide: true });
if (statusCommand.status !== 0) throw new Error('Start local Supabase first');
const status = JSON.parse(statusCommand.stdout);
if (status.API_URL !== 'http://127.0.0.1:56321') throw new Error('Unexpected Supabase target');
const envPath = '.env.local-web';
const env = await readFile(envPath, 'utf8'); // Require the dedicated local file before creating anything.
if (!env.includes('EDITORIAL_SUPABASE_URL=http://127.0.0.1:56321')) throw new Error('Run npm run web:local:env first');
const db = new pg.Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:56322/postgres' });
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  await db.connect();
  let userId = (await db.query('select id from auth.users where lower(email)=$1', [email])).rows[0]?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw new Error('Could not create local user');
    userId = data.user.id;
  }
  await db.query('insert into academy.editor_members(user_id,role) values($1,$2) on conflict(user_id) do update set role=excluded.role', [userId, role]);
  const allowed = new Set((env.match(/^EDITORIAL_EMAIL_ALLOWLIST=(.*)$/m)?.[1] || '').split(',').filter(Boolean));
  allowed.add(email);
  await writeFile(envPath, env.replace(/^EDITORIAL_EMAIL_ALLOWLIST=.*$/m, `EDITORIAL_EMAIL_ALLOWLIST=${[...allowed].join(',')}`), { mode: 0o600 });
  console.log('Local membership ready. Restart local web, request a login link and open Mailpit at http://127.0.0.1:56324. No external email was sent.');
} finally { await db.end(); }
