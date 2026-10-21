import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Call the pinned CLI without going through npm, shell quoting or printing credentials.
const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error('Local Supabase is not ready; run npm run db:start first');
const status = JSON.parse(result.stdout);
if (status.API_URL !== 'http://127.0.0.1:56321') throw new Error('Unexpected local project URL; refusing to export credentials');
const env = [
  `SUPABASE_URL=${status.API_URL}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
  'SUPABASE_DB_SCHEMA=academy',
  'SUPABASE_STORAGE_BUCKET=dobrov-academy-assets',
  'PUBLICATION_ENABLED=false', ''
].join('\n');
// Separate file: cloud .env is never overwritten. Command does not echo any key.
await writeFile('.env.local-worker', env, { mode: 0o600 });
console.log('Local worker configuration written to ignored .env.local-worker; cloud .env preserved.');
