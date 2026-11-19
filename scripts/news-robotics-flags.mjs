/** Apply only the owner's explicit video-candidate instruction. Never decide or publish news. */
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRemoteTarget} from './database-target.mjs';
const root=process.argv[2];
if(!root||!process.argv.includes('--apply-owner-video-flags'))throw Error('Exact instruction directory and apply flag required');
const sourceHash=createHash('sha256').update(await readFile(root+'/original-request.txt')).digest('hex');
if(sourceHash!=='8ae4289c6435cad66a0fbebd322f6c02b3d39d5fcbdea2ee3421bde89d10cfd6')throw Error('Unrecognized owner instruction');
const expected=JSON.parse(await readFile(root+'/import-receipts.json','utf8')).receipts;
if(expected.length!==3)throw Error('Three canonical receipts required');
const ca=await readFile(process.env.SUPABASE_DB_CA_FILE,'utf8');
const db=new pg.Client({connectionString:validateRemoteTarget(process.env.SUPABASE_DB_URL,'upwrplsgunjanragbggb'),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15000,statement_timeout:30000});
let attempted=false,committed=false;
try{
 await db.connect();await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtextextended('robotics-owner-flags:'||$1,0))",[sourceHash]);
 if(!(await db.query("select 1 from academy.install_migrations where version='202611150017_news_related_media.sql'")).rowCount)throw Error('Approved migration 017 is required first');
 const editors=(await db.query("select user_id from academy.editor_members where role='editor'")).rows;
 if(editors.length!==1)throw Error('Sole-owner identity needs reconciliation');
 const batch=(await db.query('select id,owner_authorization from academy.news_batches where source_hash=$1',[sourceHash])).rows[0];
 if(!batch||batch.owner_authorization!==null)throw Error('Preparation batch must not carry publication authorization');
 const preserve=async()=>JSON.stringify((await db.query("select jsonb_build_object('releases',(select jsonb_agg(to_jsonb(r) order by id) from academy.news_releases r),'decisions',(select jsonb_agg(to_jsonb(d) order by id) from academy.news_decisions d),'packages',(select jsonb_agg(to_jsonb(p) order by id) from academy.news_packages p)) data")).rows[0].data);
 const before=await preserve(),events=[];
 for(const r of expected){
  const state=(await db.query('select * from academy.news_state where story_id=$1 for update',[r.storyId])).rows[0];
  const pkg=(await db.query('select batch_id,package_hash from academy.news_packages where id=$1',[state?.package_id])).rows[0];
  if(state?.package_id!==r.packageId||pkg?.batch_id!==batch.id||pkg.package_hash!==r.packageHash)throw Error('Exact package changed; do not overwrite owner state');
  const hex=createHash('sha256').update(sourceHash+':video:'+r.storyId).digest('hex');const request=`${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
  const existing=(await db.query('select id,story_id,instruction_hash,kind from academy.news_metadata_events where request_id=$1',[request])).rows[0];
  if(existing){if(existing.story_id!==r.storyId||existing.instruction_hash!==sourceHash||existing.kind!=='video_candidate')throw Error('Replay conflict');events.push({storyId:r.storyId,eventId:existing.id,replayed:true,currentVideo:state.suggested_video});continue;}
  const unchanged={...state};delete unchanged.suggested_video;delete unchanged.flags_origin;delete unchanged.version;
  const event=(await db.query("insert into academy.news_metadata_events(story_id,actor_id,origin,kind,request_id,expected_version,before_value,after_value,instruction_hash) values($1,$2,'owner_instruction','video_candidate',$3,$4,$5,$6,$7) returning id",[r.storyId,editors[0].user_id,request,state.version,{suggested_video:state.suggested_video,flags_origin:state.flags_origin},{suggested_video:true,flags_origin:'owner_set'},sourceHash])).rows[0].id;
  await db.query("update academy.news_state set suggested_video=true,flags_origin='owner_set',version=version+1 where story_id=$1",[r.storyId]);
  const after={...(await db.query('select * from academy.news_state where story_id=$1',[r.storyId])).rows[0]};delete after.suggested_video;delete after.flags_origin;delete after.version;
  if(JSON.stringify(after)!==JSON.stringify(unchanged))throw Error('Unrelated editorial state changed');
  events.push({storyId:r.storyId,eventId:event,replayed:false,currentVideo:true});
 }
 if(await preserve()!==before)throw Error('Publication, decision or package changed');
 attempted=true;await db.query('commit');committed=true;
 await writeFile(root+'/owner-video-flags.json',JSON.stringify({sourceHash,appliedAt:new Date().toISOString(),origin:'owner_instruction',events,publicationCalls:0,decisionsUnchanged:true},null,2));console.log(JSON.stringify({updated:events.length,events,publicationCalls:0}));
}catch(e){if(!committed)await db.query('rollback').catch(()=>{});console.error(JSON.stringify({status:committed?'committed_receipt_missing':attempted?'commit_uncertain':'rolled_back',code:e.code??'OWNER_FLAG_GUARD',reason:attempted?'Reconcile deterministic request IDs before retry.':e.code?'Database operation failed.':e.message}));process.exitCode=1;}finally{await db.end();}
