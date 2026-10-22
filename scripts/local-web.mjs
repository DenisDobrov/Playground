import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!['dev', 'start'].includes(mode)) throw new Error('Usage: node scripts/local-web.mjs dev|start [Next options]');
// Loading in-process keeps --env-file out of execArgv. Next dev forwards Node flags
// to its child via NODE_OPTIONS, which does not allow --env-file.
try { loadEnvFile(fileURLToPath(new URL('../.env.local-web', import.meta.url))); }
catch { throw new Error('Local web environment is missing or unreadable. Run npm run web:local:env first.'); }
if (process.env.EDITORIAL_SUPABASE_URL !== 'http://127.0.0.1:56321') throw new Error('Local web must use the local Academy Supabase');
const next = new URL('../node_modules/next/dist/bin/next', import.meta.url);
process.argv = [process.execPath, fileURLToPath(next), mode, fileURLToPath(new URL('../apps/web', import.meta.url)), ...process.argv.slice(3)];
await import(next.href);
