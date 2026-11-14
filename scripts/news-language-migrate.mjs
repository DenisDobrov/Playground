/** Apply exactly NEWS-003 migration after a verified Academy-only backup and restore. */
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRemoteTarget} from './database-target.mjs';
const directory=process.argv[2];if(!directory||!process.argv.includes('--apply-news-003'))throw Error('Verified private backup directory and explicit NEWS-003 apply flag required');
const before=JSON.parse(await readFile(directory+'/before.json','utf8'));
const restore=JSON.parse(await readFile(directory+'/restore-result.json','utf8'));
const rehearsal=JSON.parse(await readFile(directory+'/rehearsal-result.json','utf8'));
const name='202611140016_news_languages.sql',sql=await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const hash=v=>createHash('sha256').update(v.replace(/\r\n/g,'\n')).digest('hex'),checksum=hash(sql);
if(before.target!=='upwrplsgunjanragbggb'||!restore.restoreVerified||!restore.fingerprintsMatch||!rehearsal.localMigrationsPassed||rehearsal.manifest.length!==1||rehearsal.manifest[0].name!==name||rehearsal.manifest[0].checksum!==checksum)throw Error('Backup/restore/rehearsal gate failed');
if(createHash('sha256').update(await readFile(directory+'/academy-before.dump')).digest('hex')!==restore.backupSha256)throw Error('Backup digest differs from the verified restore');
const ca=process.env.SUPABASE_DB_CA_FILE?await readFile(process.env.SUPABASE_DB_CA_FILE,'utf8'):undefined;
const db=new pg.Client({connectionString:validateRemoteTarget(process.env.SUPABASE_DB_URL,before.target),ssl:{rejectUnauthorized:true,...ca?{ca}:{}},connectionTimeoutMillis:15000,statement_timeout:30000});
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const fingerprints=async()=>{const rows=[];for(const t of before.fingerprints){rows.push({table:t.table,...(await db.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) hash from (select md5(row_to_json(t)::text) h from academy.${ident(t.table)} t) s`)).rows[0]});}return rows;};
let commitAttempted=false,committed=false;
try{
 await db.connect();await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtextextended('dobrov-academy-install',0))");
 const journal=(await db.query('select version,checksum from academy.install_migrations order by version')).rows;
 if(JSON.stringify(journal)!==JSON.stringify(before.installed))throw Error('Installation journal changed since backup');
 for(const migration of journal)if(hash(await readFile(new URL('../supabase/migrations/'+migration.version,import.meta.url),'utf8'))!==migration.checksum)throw Error('Installed migration checksum differs');
 if(JSON.stringify(await fingerprints())!==JSON.stringify(before.fingerprints))throw Error('Academy data changed since backup');
 await db.query(sql);await db.query('insert into academy.install_migrations(version,checksum) values($1,$2)',[name,checksum]);
 if(JSON.stringify((await fingerprints()).filter(t=>t.table!=='install_migrations'))!==JSON.stringify(before.fingerprints.filter(t=>t.table!=='install_migrations')))throw Error('Existing data unexpectedly changed');
 const legacy=(await db.query("select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage') order by 1,2")).rows;
 if(JSON.stringify(legacy)!==JSON.stringify(before.legacy))throw Error('Legacy structural or ACL state changed');
 const grants=(await db.query("select p.proname,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academy' and p.proname in ('news_apply_decision','news_claim_delivery','news_validate_languages','news_decide') order by 1")).rows;
 commitAttempted=true;await db.query('commit');committed=true;
 const receipt={migration:name,checksum,checkedAt:new Date().toISOString(),restoreVerified:true,existingAcademyRowsPreserved:true,legacySchemaAndACLsUnchanged:true,grants,publicationCalls:0};
 await writeFile(directory+'/cloud-migration-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(e){if(!committed)await db.query('rollback').catch(()=>{});console.error(JSON.stringify({status:committed?'committed_receipt_missing':commitAttempted?'commit_uncertain':'rolled_back',code:e.code??'MIGRATION_GUARD',reason:committed||commitAttempted?'Reconcile the installation journal before any retry.':e.code?'Database operation failed; no change committed.':e.message}));process.exitCode=1;}finally{await db.end();}
