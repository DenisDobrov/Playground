/** HTTP test of the built Next app; synthetic anonymous REST fixture, no DB or approvals. */
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {newsFixture} from '../fixtures/news';
const p=newsFixture('a'.repeat(64));
// Exercise long headings and Spanish accents at the image boundary.
p.es.title='Prueba sintética de diseño: fuentes, contexto y límites de un resultado científico con un título extenso para comprobar la legibilidad de la tarjeta';
const releases=(['es','en'] as const).flatMap(language=>[1,2].map(version=>({id:`${language}-${version}`,package_id:`fixture-${version}`,story_id:'synthetic',language,slug:p.slug,published_at:`2026-11-0${version+5}T00:00:00.000Z`,content:{article:p[language],sources:p.sources,period:p.period,section:p.section,verification:p.verification}})));
const analysis=structuredClone(p);analysis.slug='standalone-analysis-fixture';analysis.period='standalone:2026-11-07';
for(const language of ['es','en'] as const){analysis[language]={...analysis[language],type:'analysis',sourcePublicationMonth:'2026-06',blocks:[{type:'paragraph',text:analysis[language].paragraphs[0]},{type:'heading',text:'<script>Never executable</script>'},{type:'table',caption:'Conditional scenarios',headers:['Scenario','MW'],rows:[['Synthetic','12']],note:'Scenario, not a measurement',sourceUrl:p.sources[0].url}]};releases.push({id:`analysis-${language}`,package_id:'analysis-fixture',story_id:'analysis-synthetic',language,slug:analysis.slug,published_at:'2026-11-07T14:00:00.000Z',content:{article:analysis[language],sources:analysis.sources,period:analysis.period,section:1,verification:analysis.verification}});}
let reads=0;
const api=createServer((req,res)=>{
  if(req.method!=='GET'||!req.url?.startsWith('/rest/v1/news_releases?')){res.writeHead(404).end();return;}
  assert.equal(req.headers.authorization,'Bearer sb_publishable_test_only');reads++;
  res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(releases));
});
api.listen(0,'127.0.0.1');await once(api,'listening');const apiPort=(api.address() as {port:number}).port;
const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=(reserve.address() as {port:number}).port;await new Promise<void>(r=>reserve.close(()=>r()));
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','apps/web','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,EDITORIAL_MODE:'live',EDITORIAL_SUPABASE_URL:`http://127.0.0.1:${apiPort}`,EDITORIAL_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',EDITORIAL_SITE_URL:`http://127.0.0.1:${port}`,VERCEL_ENV:'preview'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let diagnostics='';child.stdout.on('data',b=>diagnostics+=b.toString());child.stderr.on('data',b=>diagnostics+=b.toString());
const origin=`http://127.0.0.1:${port}`;
try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'Built server did not start');
  for(const language of ['es','en'] as const){
    const path=`${language==='es'?'/noticias':'/en/news'}/${p.slug}`;
    const response=await fetch(origin+path),html=await response.text();assert.equal(response.status,200);
    assert.equal(response.headers.get('referrer-policy'),'strict-origin');
    assert.ok(html.includes(`href="https://dobrov.org${path}"`));assert.ok(html.includes(`https://dobrov.org/share/${language}/${p.slug}`));
    const json=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
    assert.equal(json.datePublished,'2026-11-06T00:00:00.000Z');assert.equal(json.dateModified,json.datePublished);
    assert.equal(json.inLanguage,language);assert.deepEqual(json.citation,p.sources.map(s=>s.url));
    assert.ok(html.includes('summary_large_image'));assert.ok(!html.includes('http://localhost:3000/share'));
    const image=await fetch(`${origin}/share/${language}/${p.slug}`),bytes=Buffer.from(await image.arrayBuffer());
    assert.equal(image.status,200);assert.match(image.headers.get('content-type')!,/image\/png/);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
    if(process.env.SEO_PROOF_DIR){await mkdir(process.env.SEO_PROOF_DIR,{recursive:true});await writeFile(resolve(process.env.SEO_PROOF_DIR,`share-${language}.png`),bytes);}
  }
  assert.equal((await fetch(origin+'/share/es/unpublished-fixture')).status,404);
  assert.equal((await fetch(origin+'/noticias/unpublished-fixture')).status,404);
  const sitemap=await(await fetch(origin+'/sitemap.xml')).text();
  for(const path of ['/','/en','/politica','/en/method','/semana/2026-11-01','/en/week/2026-11-01'])assert.ok(sitemap.includes(`<loc>https://dobrov.org${path}</loc>`));
  assert.equal((sitemap.match(/<loc>/g)||[]).length,10);assert.ok(!sitemap.includes('/editorial'));
  const home=await(await fetch(origin+'/')).text(),digest=await(await fetch(origin+'/semana/2026-11-01')).text();
  assert.notEqual(home.match(/<h1>(.*?)<\/h1>/s)?.[1],digest.match(/<h1>(.*?)<\/h1>/s)?.[1]);
  assert.ok(home.includes(analysis.slug));assert.ok(!digest.includes(analysis.slug),'Standalone must not rewrite the weekly archive');
  const analysisHtml=await(await fetch(origin+'/en/news/'+analysis.slug)).text();
  assert.ok(analysisHtml.includes('<table>'));assert.ok(analysisHtml.includes('2026-06'));assert.ok(analysisHtml.includes('June 2026'));assert.ok(!analysisHtml.includes('<script>Never executable</script>'));
  const analysisLd=JSON.parse(analysisHtml.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
  assert.equal(analysisLd['@type'],'Article');assert.equal(analysisLd.datePublished,'2026-11-07T14:00:00.000Z');
  const denied=await fetch(origin+'/editorial/news',{redirect:'manual'});assert.equal(denied.status,307);assert.ok(denied.headers.get('location')?.includes('/login'));assert.equal(denied.headers.get('referrer-policy'),'no-referrer');
  console.log(JSON.stringify({passed:true,anonymousFixtureReads:reads,esEnMetadata:true,unchangedArticleDates:true,images1200x630:true,unpublished404:true,sitemap:true,privateDenied:true,productionDataModified:false}));
}catch(e){console.error(diagnostics);throw e;}finally{child.kill();await once(child,'exit').catch(()=>{});await new Promise<void>(r=>api.close(()=>r()));}
