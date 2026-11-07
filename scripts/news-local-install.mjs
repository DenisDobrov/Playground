import pg from 'pg';
import {readFile} from 'node:fs/promises';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'});
try{
 await db.connect();await db.query('begin');
 const exists=(await db.query("select to_regclass('academy.news_batches') as t")).rows[0].t;
 if(!exists){const sql=await readFile('supabase/migrations/202611070015_news_release.sql','utf8');await db.query(sql);await db.query("insert into supabase_migrations.schema_migrations(version,name,statements) values('202611070015','news_release',$1)",[[sql]]);}
 await db.query('commit');console.log('Local Academy news schema ready. Existing records preserved.');
}catch(e){await db.query('rollback');throw e;}finally{await db.end();}
