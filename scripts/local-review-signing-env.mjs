/** Provision a dedicated local signing key without printing it or altering cloud env. */
import {readFile,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function localReviewSigningKey() {
  const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres',connectionTimeoutMillis:5000});
  try {
    await db.connect();
    const exists=(await db.query("select to_regclass('academy.review_import_signing_key') is not null as ok")).rows[0].ok;
    if(!exists) return null;
    return (await db.query("select encode(secret,'hex') as value from academy.review_import_signing_key where id")).rows[0]?.value || null;
  } finally {await db.end();}
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  const path='.env.local-web';
  const previous=await readFile(path,'utf8');
  if(!/^EDITORIAL_SUPABASE_URL=http:\/\/127\.0\.0\.1:56321\r?$/m.test(previous)) throw new Error('Only local Academy web configuration is allowed');
  const key=await localReviewSigningKey();
  if(!key) throw new Error('Apply the reviewed local migration 009 first');
  const lines=previous.split(/\r?\n/).filter(line=>!line.startsWith('EDITORIAL_REVIEW_SIGNING_KEY=')).filter(Boolean);
  await writeFile(path,[...lines,`EDITORIAL_REVIEW_SIGNING_KEY=${key}`,''].join('\n'),{mode:0o600});
  console.log('Local review signing configured in ignored .env.local-web. Existing settings preserved; restart web. No key was printed.');
}
