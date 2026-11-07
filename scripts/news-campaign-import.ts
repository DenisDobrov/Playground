/** Scoped operator command. Defaults to rollback; never approves or sends a campaign. */
import pg from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {validateCampaign} from './news-campaign-validation';
import {newsPackageSchema} from '../packages/core/src/news';
import {validateRemoteTarget} from './database-target.mjs';
const args=process.argv.slice(2),option=(n:string)=>args.find(x=>x.startsWith(n+'='))?.slice(n.length+1);
const file=option('--prepared'),report=option('--report');
if(!file||!report||args.some(a=>a.includes('approve')))throw new Error('Prepared file and report path required; approval is UI-only');
const inputs=JSON.parse(await readFile(file,'utf8'));
if(!Array.isArray(inputs)||inputs.length!==3||new Set(inputs.map(p=>p.section)).size!==3||inputs.some(p=>![2,7,16].includes(p.section)))throw new Error('Exactly campaigns 2,7,16 required');
const production=args.includes('--production=distribution-002');
const connectionString=production?validateRemoteTarget(process.env.SUPABASE_DB_URL,'upwrplsgunjanragbggb'):'postgresql://postgres:postgres@127.0.0.1:56322/postgres';
const ssl=production?{rejectUnauthorized:true,ca:await readFile(process.env.SUPABASE_DB_CA_FILE!,'utf8')}:undefined;
const db=new pg.Client({connectionString,ssl,connectionTimeoutMillis:15000,statement_timeout:15000});
db.on('error',()=>{});
try {
  await db.connect();await db.query('begin');const results=[];
  for(const input of inputs){
    const parsed=newsPackageSchema.parse(input);
    if(!parsed.campaign)throw new Error('CAMPAIGN_REQUIRED');
    const base=(await db.query('select * from academy.news_packages where id=$1',[parsed.campaign.basePackageId])).rows[0];
    if(!base||base.package_hash!==parsed.campaign.basePackageHash)throw new Error('CAMPAIGN_BASE_HASH_MISMATCH');
    const p=validateCampaign(parsed,base.content);
    if((await db.query('select count(*)::int n from academy.news_releases where package_id=$1',[base.id])).rows[0].n!==2)throw new Error('CAMPAIGN_BASE_NOT_RELEASED');
    const current=(await db.query('select s.package_id,p.content from academy.news_state s join academy.news_packages p on p.id=s.package_id where s.story_id=$1 for update of s',[base.story_id])).rows[0];
    if(!current||(current.package_id!==base.id&&!isDeepStrictEqual(current.content,p)))throw new Error('CAMPAIGN_CURRENT_VERSION_CONFLICT');
    const id=(await db.query('select academy.news_import($1,$2,$3) id',[base.batch_id,base.story_id,p])).rows[0].id;
    const state=(await db.query('select version,decision from academy.news_state where package_id=$1',[id])).rows[0];
    results.push({campaign:p.campaign!.id,section:p.section,packageId:id,...state});
  }
  const apply=args.includes('--apply');await db.query(apply?'commit':'rollback');
  const output={checkedAt:new Date().toISOString(),target:production?'production':'local',mode:apply?'imported_pending_review':'dry_run_rolled_back',results};
  await writeFile(report,JSON.stringify(output,null,2));console.log(JSON.stringify(output));
}catch(e){await db.query('rollback').catch(()=>{});console.error(JSON.stringify({stopped:true,code:(e as {code?:string}).code||((e as Error).message.startsWith('CAMPAIGN_')?(e as Error).message:'CAMPAIGN_IMPORT_FAILED')}));process.exitCode=1;}finally{await db.end();}
