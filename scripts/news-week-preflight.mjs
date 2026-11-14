// Read-only Academy inventory. Credentials and raw connection errors never enter reports.
import pg from 'pg';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {validateRemoteTarget} from './database-target.mjs';
const out=process.argv[2];
if(!out)throw new Error('Private output directory required');
const ca=process.env.SUPABASE_DB_CA_FILE?await readFile(process.env.SUPABASE_DB_CA_FILE,'utf8'):undefined;
const db=new pg.Client({connectionString:validateRemoteTarget(process.env.SUPABASE_DB_URL,'upwrplsgunjanragbggb'),ssl:{rejectUnauthorized:true,...ca?{ca}:{}},connectionTimeoutMillis:15000,statement_timeout:30000});
try{
 await db.connect();await db.query('begin read only');
 const report={checkedAt:new Date().toISOString()};
 for(const [key,sql] of Object.entries({
  migrations:'select version,checksum from academy.install_migrations order by version',
  sources:'select id,canonical_id,url,title_en from academy.sources',
  aliases:'select * from academy.source_aliases',
  links:'select * from academy.story_sources',
  stories:'select id,slug,title_en from academy.stories',
  packages:"select p.id,p.story_id,p.event_key,p.slug,p.version,p.package_hash,p.content->>'period' period,p.content->'en'->>'title' title from academy.news_packages p order by p.created_at",
  states:'select * from academy.news_state',
  releases:'select id,package_id,story_id,language,slug,published_at from academy.news_releases',
  editors:"select user_id,role from academy.editor_members where role='editor'",
  dossiers:'select id,story_id,version,author_type from academy.dossiers',
  briefs:'select id,dossier_id,preliminary from academy.editorial_briefs',
  researchTables:"select table_name from information_schema.tables where table_schema='academy' and table_name in ('dossiers','editorial_briefs','scientific_reviews')"
 }))report[key]=(await db.query(sql)).rows;
 await db.query('commit');await mkdir(out,{recursive:true});await writeFile(out+'/database-preflight.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({checkedAt:report.checkedAt,counts:Object.fromEntries(Object.entries(report).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),migrations:report.migrations.map(m=>m.version),stories:report.stories}));
}catch(e){await db.query('rollback').catch(()=>{});console.error(JSON.stringify({status:'failed',code:e.code??'CONNECTION_OR_QUERY_FAILED'}));process.exitCode=1;}finally{await db.end();}
