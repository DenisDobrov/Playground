/** Local-only metadata acceptance. All users, fixtures and optional DDL roll back. */
import pg from 'pg';import {readFile} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {newsFixture} from '../fixtures/news';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres',connectionTimeoutMillis:5000});
const editor=randomUUID(),reviewer=randomUUID(),outsider=randomUUID(),rpc='select academy.news_set_youtube($1,$2,$3,$4,$5) id';
const one=async(sql:string,args:unknown[]=[]) => (await db.query(sql,args)).rows[0];
async function role(value:string){await db.query('reset role');if(value==='postgres')return;if(['anon','service_role'].includes(value)){await db.query('set local role '+value);return;}await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[value]);}
async function denied(sql:string,args:unknown[]=[],code?:string){await db.query('savepoint denied');let error:any;try{await db.query(sql,args);}catch(e){error=e;}await db.query('rollback to savepoint denied');await db.query('release savepoint denied');assert.ok(error,'Operation must fail');if(code)assert.equal(error.code,code);}
try{
 await db.connect();await db.query('begin');
 if(!(await one("select exists(select 1 from information_schema.columns where table_schema='academy' and table_name='news_state' and column_name='youtube_id') yes")).yes)await db.query(await readFile('supabase/migrations/202611150017_news_related_media.sql','utf8'));
 for(const id of [editor,reviewer,outsider])await db.query("insert into auth.users(id,email) values($1,$2)",[id,id+'@synthetic.invalid']);
 await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",[editor,reviewer]);
 const source='SYNTHETIC NEWS MEDIA ACCEPTANCE '+randomUUID(),hash=createHash('sha256').update(source).digest('hex');
 const batch=(await one("insert into academy.news_batches(source_text,period_start,period_end) values($1,'2026-11-15','2026-11-15') returning id",[source])).id;
 const stories:string[]=[],packages:string[]=[];
 for(let i=0;i<3;i++){const p=newsFixture(hash);p.slug='synthetic-media-'+randomUUID();p.eventKey=p.slug;p.section=i+1;await role('service_role');const pid=(await one('select academy.news_import($1,null,$2) id',[batch,p])).id;const state=await one('select * from academy.news_state where package_id=$1',[pid]);stories.push(state.story_id);packages.push(pid);if(i<2){await role(editor);await one("select academy.news_decide($1,0,$2,'approve','synthetic',false,false)",[pid,randomUUID()]);}}
 await role('postgres');const preserved=await one("select jsonb_build_object('packages',(select jsonb_agg(to_jsonb(p) order by id) from academy.news_packages p where id=any($1::uuid[])),'releases',(select jsonb_agg(to_jsonb(r) order by id) from academy.news_releases r where package_id=any($1::uuid[])),'decisions',(select jsonb_agg(to_jsonb(d) order by id) from academy.news_decisions d where package_id=any($1::uuid[]))) data",[packages]);
 const stateBefore=await one('select package_id,version,decision,comment,suggested_video,suggested_science,updated_at from academy.news_state where story_id=$1',[stories[0]]);
 for(const actor of [reviewer,outsider,'anon','service_role']){await role(actor);await denied(rpc,[stories[0],0,randomUUID(),'OfJnrExLe4M','en'],'42501');}
 await role(editor);await denied('update academy.news_state set youtube_id=$1 where story_id=$2',['OfJnrExLe4M',stories[0]],'42501');
 for(const [id,language]of [['bad','en'],['https://youtu.be/OfJnrExLe4M','en'],['OfJnrExLe4M','xx'],[null,'en']])await denied(rpc,[stories[0],0,randomUUID(),id,language],'22023');
 const request=randomUUID(),event=(await one(rpc,[stories[0],0,request,'OfJnrExLe4M','en'])).id;
 assert.equal((await one(rpc,[stories[0],0,request,'OfJnrExLe4M','en'])).id,event);
 await denied(rpc,[stories[0],0,request,'AAAAAAAAAAA','en'],'22023');await denied(rpc,[stories[0],0,randomUUID(),'AAAAAAAAAAA','en'],'40001');
 await one(rpc,[stories[1],0,randomUUID(),'OfJnrExLe4M','en']);await one(rpc,[stories[2],0,randomUUID(),'OfJnrExLe4M','en']);
 await role('anon');assert.equal((await db.query('select * from academy.news_public_media where story_id=any($1::uuid[])',[stories])).rowCount,2);await denied('select * from academy.news_state',[],'42501');await denied('select * from academy.news_metadata_events',[],'42501');
 await role(editor);await one(rpc,[stories[0],1,randomUUID(),'AAAAAAAAAAA','es']);assert.equal((await one('select youtube_id from academy.news_state where story_id=$1',[stories[0]])).youtube_id,'AAAAAAAAAAA');
 await one(rpc,[stories[0],2,randomUUID(),null,null]);const cleared=await one('select * from academy.news_state where story_id=$1',[stories[0]]);assert.equal(cleared.youtube_id,null);assert.equal(cleared.youtube_configured,true);assert.equal(cleared.media_version,3);
 assert.deepEqual(await one('select package_id,version,decision,comment,suggested_video,suggested_science,updated_at from academy.news_state where story_id=$1',[stories[0]]),stateBefore);
 await denied('update academy.news_metadata_events set after_value=$1 where id=$2',[{},event],'42501');
 await role('postgres');await denied('delete from academy.news_metadata_events where id=$1',[event]);
 assert.deepEqual(await one("select jsonb_build_object('packages',(select jsonb_agg(to_jsonb(p) order by id) from academy.news_packages p where id=any($1::uuid[])),'releases',(select jsonb_agg(to_jsonb(r) order by id) from academy.news_releases r where package_id=any($1::uuid[])),'decisions',(select jsonb_agg(to_jsonb(d) order by id) from academy.news_decisions d where package_id=any($1::uuid[]))) data",[packages]),preserved);
 await role(reviewer);assert.equal((await db.query('select * from academy.news_metadata_events where story_id=any($1::uuid[])',[stories])).rowCount,5);
 await role(outsider);assert.equal((await db.query('select * from academy.news_metadata_events where story_id=any($1::uuid[])',[stories])).rowCount,0);
 await role('postgres');await db.query('rollback');console.log(JSON.stringify({passed:true,editorOnly:true,addReplaceRemove:true,replayConflict:true,sharedIds:true,draftPrivacy:true,immutableAudit:true,releaseApprovalAndArticlePreserved:true,productionDataModified:false}));
}catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
