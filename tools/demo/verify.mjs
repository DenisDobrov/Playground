// Real artifact verification, independent of generation. Never records human approval.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {request} from 'node:http';
import {once} from 'node:events';
const root=resolve(process.argv[2]||'artifacts/demo-001');
const latest=JSON.parse(await readFile(join(root,'latest.json'),'utf8'));
const revision=process.argv.slice(3).find(value=>!value.startsWith('--'))||latest.revision;
assert.match(revision,/^[a-f0-9]{64}$/);
const dir=join(root,'revisions',revision),read=async n=>JSON.parse(await readFile(join(dir,n),'utf8'));
const manifest=await read('manifest.json'),storyboard=await read('storyboard.json'),qa=await read('qa.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const f of manifest.files){assert(!f.path.includes('..'));const bytes=await readFile(join(dir,f.path));assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);}
assert.equal(manifest.publicationEnabled,false);assert.equal(manifest.cost.externalApiCalls,0);
assert.equal(manifest.humanApproval,'OWNER REVIEW REQUIRED');assert.deepEqual(storyboard.humanReviews,[]);
assert(storyboard.releaseIssues.length>0);assert(manifest.main.duration>=60&&manifest.main.duration<=120);assert(manifest.short.duration>=15&&manifest.short.duration<=30);
for(const name of ['main','short']){
 assert.equal(qa[name].status,'PASS');assert.equal(qa[name].subtitleTimingValidated,true);
 const text=await readFile(join(dir,name==='main'?'captions-es.srt':'short-es.srt'),'utf8');
 const time=s=>{const [h,m,x]=s.split(':');return Number(h)*3600+Number(m)*60+Number(x.replace(',','.'));};
 let previous=0,count=0;
 for(const match of text.matchAll(/(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})\n([^\n]+)/g)){
  const start=time(match[1]),end=time(match[2]);assert(start>=previous-.001);assert(end>start);assert(end<=manifest[name].duration+.001);previous=end;count++;
 }
 assert.equal(count,qa[name].subtitleCueCount);assert(count>3);
}
const social=await read('social-drafts.json');for(const platform of ['youtube','linkedin','x','instagram','threads','facebook','telegram','whatsappChannel','newsletter']){assert(social[platform].es);assert(social[platform].en);}
for(const [name,w,h] of [['youtube-thumbnail',1280,720],['website-og',1200,630],['instagram-square',1080,1080],['instagram-card',1080,1350],['linkedin',1200,627],['x-card',1200,675]]){const png=await readFile(join(dir,'social',name+'.png'));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);}
const chapters=social.youtube.chapters;assert.equal(chapters[0].seconds,0);for(let i=1;i<chapters.length;i++)assert(chapters[i].seconds-chapters[i-1].seconds>=10);assert(manifest.main.duration-chapters.at(-1).seconds>=10);
const result={at:new Date().toISOString(),revision,artifactChecksums:'PASS',subtitleTimings:'PASS',releaseBlocked:'PASS',socialLanguages:'PASS',socialImageDimensions:'PASS',publicationEnabled:false,externalApiCalls:0};
const compare=process.argv.find(value=>value.startsWith('--compare='))?.slice('--compare='.length);
if(compare){
 assert.match(compare,/^[a-f0-9]{64}$/);const before=JSON.parse(await readFile(join(root,'revisions',compare,'storyboard.json'),'utf8'));
 assert.equal(manifest.variant,'visual-detail');assert.equal(manifest.cache.audioHits,14);assert.equal(manifest.cache.panHits,13);assert.equal(manifest.cache.muxHits,16);
 const changed=storyboard.scenes.filter((s,i)=>s.panInputHash!==before.scenes[i].panInputHash).map(s=>s.id);assert.deepEqual(changed,['rule']);
 for(const [i,s] of storyboard.scenes.entries()){assert.equal(s.narrationEs,before.scenes[i].narrationEs);assert.equal(s.audioHash,before.scenes[i].audioHash);if(s.id!=='rule')assert.equal(s.clipHash,before.scenes[i].clipHash);}
 result.partialRender={status:'PASS',comparedRevision:compare,changedScenes:changed,audioHits:14,panHits:13,muxHits:16};
}
if(process.argv.includes('--viewer')){
 const port=3151,server=spawn(process.execPath,['tools/demo/serve.mjs',root,String(port)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Viewer startup timeout')),10000);server.once('error',no);server.stdout.once('data',()=>{clearTimeout(timer);yes();});});
  const base='http://127.0.0.1:'+port;
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('x-robots-tag'),/noindex/);assert.match(page.headers.get('cache-control'),/no-store/);assert.match(await page.text(),/DEMO SINTÉTICA/);
  const range=await fetch(base+'/revisions/'+revision+'/main.mp4',{headers:{Range:'bytes=0-63'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,64);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,403);
  const foreignHost=await new Promise((yes,no)=>{const req=request(base+'/',{headers:{Host:'untrusted.example'}},res=>{res.resume();res.once('end',()=>yes(res.statusCode));});req.once('error',no);req.end();});assert.equal(foreignHost,403);
  assert.notEqual((await fetch(base+'/%2e%2e%2fpackage.json')).status,200);
  assert.equal((await fetch(base+'/revisions/'+revision+'/main.mp4',{headers:{Range:'bytes=99999999999-'}})).status,416);
  result.privateViewer='PASS: loopback, noindex, range, method/host/path denial';
 }finally{const closed=once(server,'close');server.kill();await closed;}
}
await mkdir(join(root,'verification'),{recursive:true});await writeFile(join(root,'verification',revision+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
