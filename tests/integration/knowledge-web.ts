/** Focused local-only browser protocol acceptance; no personal browser sessions or cloud data. */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import pg from 'pg';
import {newsFixture} from '../fixtures/news';

const origin='http://localhost:3109',api='http://127.0.0.1:56321';
const statusCall=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',windowsHide:true});
assert.equal(statusCall.status,0,'Local Academy required');const status=JSON.parse(statusCall.stdout);assert.equal(status.API_URL,api);
const admin=createClient(api,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56322/postgres'});
const users:string[]=[],run=randomUUID();let web:ReturnType<typeof spawn>|undefined,batch:string|undefined,story:string|undefined;
const decode=(s:string)=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#x27;',"'");
class Browser {
 cookies=new Map<string,string>();
 async request(path:string,options:RequestInit={}){const url=new URL(path,origin);assert.equal(url.origin,origin);const res=await fetch(url,{...options,redirect:'manual',headers:{Cookie:[...this.cookies].map(([n,v])=>n+'='+v).join('; '),...options.headers}});for(const c of res.headers.getSetCookie()){const pair=c.split(';')[0],at=pair.indexOf('=');this.cookies.set(pair.slice(0,at),pair.slice(at+1));}return res;}
 post(path:string,body:FormData,requestOrigin=origin){return this.request(path,{method:'POST',body,headers:{Origin:requestOrigin}});}
}
function form(html:string,marker:string){const body=[...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m=>m[1]).find(s=>s.includes(marker));assert.ok(body,'Missing rendered action '+marker);const data=new FormData();for(const m of body.matchAll(/<input\b[^>]*>/g)){const name=m[0].match(/name="([^"]+)"/)?.[1],value=m[0].match(/value="([^"]*)"/)?.[1];if(name)data.set(decode(name),decode(value??''));}assert.ok([...data.keys()].some(k=>k.startsWith('$ACTION_')));return data;}
async function session(email:string){const browser=new Browser();const generated=await admin.auth.admin.generateLink({type:'magiclink',email});assert.equal(generated.error,null);const client=createServerClient(api,status.ANON_KEY,{cookieOptions:{name:'da-academy-auth',httpOnly:true,sameSite:'lax',secure:false,path:'/'},cookies:{getAll:()=>[...browser.cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>browser.cookies.set(v.name,v.value))}});assert.equal((await client.auth.verifyOtp({type:'email',token_hash:generated.data.properties.hashed_token})).error,null);return browser;}
try{
 await db.connect();
 const emails=['editor','reviewer','outsider'].map(role=>`kb-${role}-${run}@synthetic.invalid`);
 for(const email of emails){const created=await admin.auth.admin.createUser({email,email_confirm:true});assert.equal(created.error,null);users.push(created.data.user!.id);}
 await db.query("insert into academy.editor_members(user_id,role) values($1,'editor'),($2,'reviewer')",users.slice(0,2));
 await new Promise<void>((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(3109,'localhost',()=>s.close(()=>resolve()));});
 web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','localhost','--port','3109'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,EDITORIAL_MODE:'live',EDITORIAL_SUPABASE_URL:api,EDITORIAL_SUPABASE_PUBLISHABLE_KEY:status.ANON_KEY,EDITORIAL_SITE_URL:origin,EDITORIAL_EMAIL_ALLOWLIST:emails.join(',')}});
 await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Build/start required')),30000);web!.stdout!.on('data',chunk=>{if(String(chunk).includes('Ready')){clearTimeout(timeout);resolve();}});web!.once('exit',()=>{clearTimeout(timeout);reject(new Error('Test web exited'));});web!.stderr!.resume();});
 const editor=await session(emails[0]),reviewer=await session(emails[1]),outsider=await session(emails[2]),anon=new Browser();
 const b=(await db.query("insert into academy.news_batches(source_text,period_start,period_end) values($1,'2026-11-21','2026-11-21') returning id,source_hash",['KB HTTP SYNTHETIC '+run])).rows[0];batch=b.id;
 const content=newsFixture(b.source_hash);content.slug='kb-http-'+run;content.eventKey=content.slug;content.en.title='KB HTTP SYNTHETIC — Reading AI research';content.es.title='KB HTTP SYNTHETIC — Cómo leer estudios de IA';content.en.tags=['KB HTTP SYNTHETIC'];content.sources[0].title='KB HTTP SYNTHETIC — primary source';content.sources[0].url='https://example.org/'+run;
 const pkg=(await db.query('select academy.news_import($1,null,$2) id',[batch,content])).rows[0].id;story=(await db.query('select story_id from academy.news_packages where id=$1',[pkg])).rows[0].story_id;
 const path='/editorial/knowledge?mode=context&q=KB%20HTTP%20SYNTHETIC&package='+pkg+'&entry='+encodeURIComponent('news-source:'+pkg+':1');
 assert.equal((await anon.request(path)).headers.get('location'),'/login');assert.match((await outsider.request(path)).headers.get('location')??'',/notice=access/);
 const page=await editor.request(path);assert.equal(page.status,200);assert.match(page.headers.get('cache-control')??'',/no-store/);const html=await page.text();assert.match(html,/Автоматическое обоснование/);assert.match(html,/необязательно/);assert.match(html,/noindex/);
 const cmd=form(html,'name="entry"');cmd.set('decision','accept');cmd.set('comment','Synthetic owner comment. Context only; no scientific approval.');
 assert.ok((await reviewer.post(path,cmd)).status>=400);assert.ok((await editor.post(path,cmd,'https://attacker.example')).status>=400);
 assert.ok(!(await (await reviewer.request(path)).text()).includes('name="request"'));
 const forged=form(html,'name="entry"');forged.set('decision','accept');forged.set('hash','b'.repeat(64));assert.match((await editor.post(path,forged)).headers.get('location')??'',/notice=conflict/);
 for(let i=0;i<2;i++)assert.match((await editor.post(path,cmd)).headers.get('location')??'',/notice=saved/);
 const rows=(await db.query('select actor_id,decision,entry_snapshot from academy.knowledge_context_decisions where package_id=$1',[pkg])).rows;assert.equal(rows.length,1);assert.equal(rows[0].actor_id,users[0]);assert.equal(rows[0].decision,'accept');
 assert.equal((await db.query('select decision from academy.news_state where package_id=$1',[pkg])).rows[0].decision,null);
 const reload=await (await editor.request(path)).text();assert.match(reload,/Связь с этой версией сохранена/);assert.match(reload,/Сохранённый контекст/);
 // Optional private visual artifacts contain only this synthetic filtered page, never cookies.
 if(process.env.KB_CAPTURE==='1'){await mkdir('artifacts/knowledge-base',{recursive:true});await writeFile('artifacts/knowledge-base/context.html',reload.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));}
 const news=await (await editor.request('/editorial/news?q=KB%20HTTP%20SYNTHETIC')).text();assert.match(news,/Knowledge Base/);const logout=form(news,'Выйти');assert.equal((await editor.post('/editorial/news',logout)).headers.get('location'),'/login');assert.equal((await editor.request(path)).headers.get('location'),'/login');
 console.log('PASS KB HTTP: authenticated page, anonymous/outsider denial, reviewer read-only, CSRF, exact snapshot validation, save/replay/reload, separate optional comment, unchanged publication decision, logout denial. Synthetic fixtures cleaned.');
}finally{
 if(web&&web.exitCode===null)web.kill();
 if(batch){await db.query('begin');await db.query('set local session_replication_role=replica');await db.query('delete from academy.knowledge_context_decisions where package_id in(select id from academy.news_packages where batch_id=$1)',[batch]);await db.query('delete from academy.news_state where story_id=$1',[story]);await db.query('delete from academy.news_packages where batch_id=$1',[batch]);await db.query('delete from academy.news_batches where id=$1',[batch]);await db.query('delete from academy.stories where id=$1',[story]);await db.query('commit');}
 for(const id of users)await admin.auth.admin.deleteUser(id);await db.end();
}
