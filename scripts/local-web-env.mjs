import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import {localReviewSigningKey} from './local-review-signing-env.mjs';
// Dedicated local-only file; cloud .env.local and web .env.local remain untouched.
const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error('Start the local Supabase first');
const status = JSON.parse(result.stdout);
if (status.API_URL !== 'http://127.0.0.1:56321') throw new Error('Unexpected local project');
const reviewKey=await localReviewSigningKey();
await writeFile('.env.local-web', [
  'EDITORIAL_MODE=live', `EDITORIAL_SUPABASE_URL=${status.API_URL}`,
  `EDITORIAL_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY || status.ANON_KEY}`,
  'EDITORIAL_SITE_URL=http://localhost:3000',
  'EDITORIAL_EMAIL_ALLOWLIST=editor@academy.example.test,reviewer@academy.example.test,outsider@academy.example.test',
  ...(reviewKey ? [`EDITORIAL_REVIEW_SIGNING_KEY=${reviewKey}`] : []), ''
].join('\n'), { mode: 0o600 });
console.log('Local web configuration written to ignored .env.local-web. No cloud settings changed.');
