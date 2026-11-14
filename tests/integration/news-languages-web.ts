/** Built Next HTTP acceptance with anonymous synthetic REST fixtures; no database. */
import {createServer,type Server} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {newsFixture} from '../fixtures/news';
import type {NewsRelease} from '../../apps/web/lib/news-seo';

const languages=['es','en','ru','zh-Hans'] as const;
type Language=typeof languages[number];
const home:Record<Language,string>={es:'/es',en:'/en',ru:'/ru','zh-Hans':'/zh'};
const newsPath=(l:Language,slug:string)=>`${l==='es'?'/noticias':home[l]+'/news'}/${slug}`;
const listing=(l:Language,kind:string)=>l==='es'?({news:'/noticias',analysis:'/analisis',topics:'/temas',search:'/buscar',archive:'/archivo'}[kind]!):home[l]+'/'+kind;
const week=(l:Language,start:string)=>`${l==='es'?'/semana':home[l]+'/week'}/${start}`;
const labels={es:'Español',en:'English',ru:'Русский','zh-Hans':'简体中文'};
const why={es:'Por qué importa',en:'Why it matters',ru:'Почему это важно','zh-Hans':'为什么重要'};
const limits={es:'Límites y próximos pasos',en:'Limits and next steps',ru:'Ограничения и следующие шаги','zh-Hans':'局限与下一步'};
const titles={es:'Prueba sintética: ciencia, contexto y límites de una noticia publicada en cuatro idiomas',en:'Synthetic science news: evidence, context and limits across four published languages',ru:'Синтетическая научная новость: источники, контекст и ограничения четырёх языковых версий','zh-Hans':'科学新闻合成测试：原始来源、研究背景、证据边界与四种语言版本'};
const fixture=newsFixture('a'.repeat(64));
const slug='synthetic-four-language-week',legacySlug='synthetic-spanish-only-archive',analysisSlug='synthetic-four-language-analysis';
const published='2026-11-14T09:00:00.000Z',reapproved='2026-11-14T10:00:00.000Z';
const drafts=[{slug:'unpublished-draft-fixture',privateDossier:'NEVER_PUBLIC_PRIVATE_DOSSIER'}];
const releases:NewsRelease[]=[];
for(const language of languages){
  const paragraphs=[`${titles[language]}. SYNTHETIC_FIXTURE_ONLY.`,({es:'Permite comprobar la presentación. No anuncia un descubrimiento.',en:'This checks presentation. It announces no discovery.',ru:'Проверяется отображение. Научное открытие не заявляется.','zh-Hans':'用于检查网页呈现。没有宣布科学发现。'}[language]),({es:'Solo datos de prueba.',en:'Test data only.',ru:'Только тестовые данные.','zh-Hans':'仅为测试数据。'}[language])];
  const article={title:titles[language],paragraphs,limitations:paragraphs[2],type:'news' as const,topic:'ai' as const,sourcePublicationMonth:'2026-06',blocks:[{type:'paragraph' as const,text:paragraphs[0]},{type:'heading' as const,text:why[language]},{type:'paragraph' as const,text:paragraphs[1]},{type:'heading' as const,text:limits[language]},{type:'paragraph' as const,text:paragraphs[2]}]};
  const content={article,sources:fixture.sources,period:'2026-11-07/2026-11-14',section:7,verification:fixture.verification,eventDates:[{kind:'news_event' as const,date:'2026-11-12',source:fixture.sources[0].url,notes:'Synthetic event date, distinct from journal month and release date.'}]};
  releases.push(...[published,reapproved].map((published_at,index)=>({id:`four-${language}-${index}`,package_id:`four-package-${index}`,story_id:'four-language-story',language,slug,published_at,content})));
  releases.push({id:`analysis-${language}`,package_id:'analysis-package',story_id:'four-language-analysis',language,slug:analysisSlug,published_at:'2026-11-13T08:00:00.000Z',content:{...content,article:{...article,title:titles[language]+' — ANALYSIS_FIXTURE',type:'analysis'},period:'standalone:2026-11-13',section:1}});
}
releases.push({id:'legacy-es',package_id:'legacy-package',story_id:'legacy-story',language:'es',slug:legacySlug,published_at:'2026-11-06T12:00:00.000Z',content:{article:{...fixture.es,title:'Archivo sintético: solo versión española'},sources:fixture.sources,period:'2026-11-01/2026-11-07',section:2,verification:fixture.verification}});
// The REST fixture models the anonymous published-row policy, not service-role access.
const future:NewsRelease={...releases[0],id:'future-fixture',package_id:'future-package',story_id:'future-story',slug:'scheduled-future-fixture',published_at:'2026-12-01T00:00:00.000Z'};
const stored=[...releases,future];
const visible=stored.filter(r=>r.published_at<='2026-11-14T23:59:59.999Z');
let reads=0;
const unexpected:string[]=[];
const api=createServer((req,res)=>{
  if(req.method!=='GET'||!req.url?.startsWith('/rest/v1/news_releases?')){unexpected.push(`${req.method} ${req.url}`);res.writeHead(404).end();return;}
  if(req.headers.authorization!=='Bearer sb_publishable_test_only'||req.headers.apikey!=='sb_publishable_test_only'){unexpected.push('Unexpected authentication');res.writeHead(401).end();return;}
  if(req.headers['accept-profile']!=='academy'){unexpected.push('Unexpected schema');res.writeHead(400).end();return;}
  reads++;res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(visible));
});
async function listen(server:Server){server.listen(0,'127.0.0.1');await once(server,'listening');return (server.address() as {port:number}).port;}
const apiPort=await listen(api),reserve=createServer(),port=await listen(reserve);
await new Promise<void>(resolveClose=>reserve.close(()=>resolveClose()));
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','apps/web','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,EDITORIAL_MODE:'live',EDITORIAL_SUPABASE_URL:`http://127.0.0.1:${apiPort}`,EDITORIAL_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',EDITORIAL_SITE_URL:`http://127.0.0.1:${port}`,VERCEL_ENV:'preview'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let diagnostics='';const capture=(b:Buffer)=>{diagnostics=(diagnostics+b.toString()).slice(-60000);};
child.stdout.on('data',capture);child.stderr.on('data',capture);
const origin=`http://127.0.0.1:${port}`,canonical='https://dobrov.org';
const failures:{name:string;message:string}[]=[],passed:string[]=[];
async function check(name:string,run:()=>Promise<void>){try{await run();passed.push(name);}catch(error){failures.push({name,message:error instanceof Error?error.message:String(error)});}}
async function page(path:string,init:RequestInit={}){const response=await fetch(origin+path,{signal:AbortSignal.timeout(15000),...init});return {response,html:await response.text()};}
const tags=(html:string,tag:string)=>html.match(new RegExp(`<${tag}\\b[^>]*>`,'g'))??[];
const attribute=(tag:string,name:string)=>tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`,'i'))?.[1];
const canonicalOf=(html:string)=>tags(html,'link').find(tag=>attribute(tag,'rel')==='canonical');
const alternates=(html:string)=>Object.fromEntries(tags(html,'link').filter(tag=>attribute(tag,'rel')==='alternate'&&attribute(tag,'hrefLang')).map(tag=>[attribute(tag,'hrefLang'),attribute(tag,'href')]));
const robots=(html:string)=>tags(html,'meta').filter(tag=>attribute(tag,'name')==='robots').map(tag=>attribute(tag,'content')).join(',');
const jsonLd=(html:string)=>[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m=>JSON.parse(m[1]));
const expectedAlternates=(available:readonly Language[],articleSlug:string)=>Object.fromEntries([...available.map(l=>[l,canonical+newsPath(l,articleSlug)]),...(available.includes('es')?[['x-default',canonical+newsPath('es',articleSlug)]]:[])]);
const navOf=(html:string)=>html.match(/<nav class="language-nav".*?<\/nav>/s)?.[0]??'';
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{if((await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
    if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,`Built server did not start: ${diagnostics}`);
  for(const language of languages){
    await check(`${language}: article, dates, exact published alternates and UI`,async()=>{
      const path=newsPath(language,slug),{response,html}=await page(path,{headers:{'Accept-Language':'es','Cookie':'da-language=es'}});
      assert.equal(response.status,200);assert.equal(response.headers.get('referrer-policy'),'strict-origin');
      assert.ok(html.includes(`<h1>${titles[language]}</h1>`));assert.ok(html.includes(`lang="${language}"`));
      assert.ok(html.includes(`<h2>${why[language]}</h2>`));assert.ok(html.includes(`<h2>${limits[language]}</h2>`));
      assert.equal(attribute(canonicalOf(html)!,'href'),canonical+path);
      assert.deepEqual(alternates(html),expectedAlternates(languages,slug));assert.ok(!robots(html).includes('noindex'));
      const article=jsonLd(html).find(v=>v['@type']==='NewsArticle');assert.ok(article);
      assert.equal(article.inLanguage,language);assert.equal(article.datePublished,published);assert.equal(article.dateModified,published,'Unchanged reapproval must preserve editorial modification date');
      assert.deepEqual(article.citation,fixture.sources.map(s=>s.url));
      assert.ok(html.includes('dateTime="2026-06"')||html.includes('datetime="2026-06"'));
      const expectedMonth=new Date('2026-06-01T00:00:00Z').toLocaleDateString({es:'es',en:'en-GB',ru:'ru-RU','zh-Hans':'zh-CN'}[language],{month:'long',year:'numeric',timeZone:'UTC'});
      assert.ok(html.includes(expectedMonth),`Missing localised journal month ${expectedMonth}`);
      const nav=navOf(html);for(const l of languages){assert.ok(nav.includes(labels[l]));assert.ok(nav.includes(`href="${newsPath(l,slug)}"`));}
      assert.ok(tags(nav,'a').some(a=>attribute(a,'hrefLang')===language&&attribute(a,'aria-current')==='page'));
      for(const secret of ['NEVER_PUBLIC_PRIVATE_DOSSIER','service_role','sourceReview','languageChecks'])assert.ok(!html.includes(secret));
    });
    await check(`${language}: share image PNG, 1200x630 and noindex`,async()=>{
      const response=await fetch(`${origin}/share/${language}/${slug}`,{signal:AbortSignal.timeout(30000)}),bytes=Buffer.from(await response.arrayBuffer());
      assert.equal(response.status,200,bytes.subarray(0,300).toString());assert.match(response.headers.get('content-type')??'',/image\/png/);
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);assert.ok(bytes.length>10000);
      assert.equal(response.headers.get('x-robots-tag'),'noindex');assert.match(response.headers.get('cache-control')??'',/max-age=300/);
      if(process.env.SEO_PROOF_DIR){await mkdir(process.env.SEO_PROOF_DIR,{recursive:true});await writeFile(resolve(process.env.SEO_PROOF_DIR,`share-${language}.png`),bytes);}
    });
    await check(`${language}: home, lists, topics, analysis and 7–14 weekly issue`,async()=>{
      const {response,html}=await page(home[language],{headers:{'Accept-Language':language}});assert.equal(response.status,200);assert.ok(html.includes(titles[language]));
      if(language==='ru'||language==='zh-Hans')assert.ok(!html.includes('Archivo sintético: solo versión española'),'Untranslated article must not masquerade as a translated listing');
      for(const kind of ['news','analysis','topics','archive']){
        const result=await page(listing(language,kind));assert.equal(result.response.status,200);assert.ok(!robots(result.html).includes('noindex'),`${listing(language,kind)} unexpectedly returns robots=${robots(result.html)}`);
        if(kind==='analysis')assert.ok(result.html.includes('ANALYSIS_FIXTURE'));
      }
      assert.equal((await page(listing(language,'topics')+'/ai')).response.status,200);
      const digest=await page(week(language,'2026-11-07'));assert.equal(digest.response.status,200);assert.ok(digest.html.includes('2026-11-07/2026-11-14'));assert.ok(digest.html.includes(titles[language]));assert.ok(!digest.html.includes('ANALYSIS_FIXTURE'));assert.ok(!digest.html.includes('Archivo sintético'));
    });
    await check(`${language}: search and query URLs never index`,async()=>{
      for(const path of [listing(language,'search'),listing(language,'search')+'?q=absent-fixture',listing(language,'news')+'?q=SYNTHETIC_FIXTURE_ONLY',listing(language,'news')+'?range=week',listing(language,'news')+'?page=2']){
        const {response,html}=await page(path);assert.equal(response.status,200);assert.match(robots(html),/noindex/,path);
        const canonicalTag=canonicalOf(html);if(canonicalTag)assert.ok(!attribute(canonicalTag,'href')!.includes('?'),'Query variants must canonicalise to the clean URL');
      }
      const repeated=await page(listing(language,'search')+'?q=one&q=two');assert.equal(repeated.response.status,200);assert.match(robots(repeated.html),/noindex/);
    });
  }
  for(const language of ['ru','zh-Hans'] as const){
    await check(`${language}: missing translation has Spanish canonical, notice and noindex`,async()=>{
      const {response,html}=await page(newsPath(language,legacySlug));assert.equal(response.status,200);assert.ok(html.includes('Archivo sintético: solo versión española'));
      assert.ok(html.includes(language==='ru'?'Запрошенный перевод ещё не опубликован':'所选译文尚未发布'));
      assert.match(robots(html),/noindex/);assert.equal(attribute(canonicalOf(html)!,'href'),canonical+newsPath('es',legacySlug));
      assert.deepEqual(alternates(html),expectedAlternates(['es'],legacySlug));
      const article=jsonLd(html).find(v=>v['@type']==='NewsArticle');assert.equal(article.inLanguage,'es');assert.equal(article.url,canonical+newsPath('es',legacySlug));
      assert.equal((await fetch(`${origin}/share/${language}/${legacySlug}`)).status,404,'Never invent a share image for an unpublished translation');
    });
  }
  await check('root negotiation: Accept-Language, manual cookie, explicit URL and caches',async()=>{
    const cases=[{accept:'ru-RU,es;q=0.8',cookie:undefined,target:'/ru'},{accept:'zh-CN,en;q=0.8',cookie:undefined,target:'/zh'},{accept:'fr-FR,ru;q=0.7,en;q=0.9',cookie:undefined,target:'/en'},{accept:'ru;q=0,en;q=0.7',cookie:undefined,target:'/en'},{accept:'zh-Hant,fr;q=0.5',cookie:undefined,target:'/es'},{accept:'ru-RU',cookie:'da-language=zh-Hans',target:'/zh'},{accept:'ru-RU',cookie:'da-language=es',target:'/es'},{accept:'en',cookie:'da-language=ru',target:'/ru'},{accept:'en',cookie:'da-language=invalid',target:'/en'}];
    const rootProblems:string[]=[];
    for(const row of cases){
      try{
      const response=await fetch(origin+'/',{redirect:'manual',headers:{'Accept-Language':row.accept,...row.cookie?{Cookie:row.cookie}:{}},signal:AbortSignal.timeout(15000)});
      assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location')!,origin).pathname,row.target);
      assert.match(response.headers.get('vary')??'',/Accept-Language/i);assert.match(response.headers.get('vary')??'',/Cookie/i);assert.match(response.headers.get('cache-control')??'',/private/);assert.match(response.headers.get('cache-control')??'',/no-store/);
      }catch(error){rootProblems.push(`Accept-Language=${row.accept}; cookie=${row.cookie??'(none)'}; target=${row.target}: ${error instanceof Error?error.message:String(error)}`);}
    }
    const explicit=await fetch(origin+newsPath('en',slug),{redirect:'manual',headers:{'Accept-Language':'ru',Cookie:'da-language=zh-Hans'}});assert.equal(explicit.status,200);assert.equal(explicit.headers.get('location'),null);
    const spanish=await fetch(origin+'/es',{redirect:'manual',headers:{'Accept-Language':'ru',Cookie:'da-language=ru'}});assert.equal(spanish.status,200);assert.equal(spanish.headers.get('location'),null,'An explicit Spanish home overrides browser/cookie preferences');
    assert.ok((await spanish.text()).includes(titles.es));
    assert.deepEqual(rootProblems,[]);
    // HTTP verifies cookie precedence; UI click storage itself needs browser execution.
  });
  await check('sitemap contains only actual released languages and weekly archives',async()=>{
    const {response,html:xml}=await page('/sitemap.xml');assert.equal(response.status,200);
    const entries=xml.match(/<url>.*?<\/url>/gs)??[];
    for(const language of languages){
      const url=canonical+newsPath(language,slug),entry=entries.find(e=>e.includes(`<loc>${url}</loc>`));assert.ok(entry);
      for(const target of languages)assert.ok(entry.includes(`hreflang="${target}"`));
      for(const path of [home[language],listing(language,'news'),listing(language,'archive'),week(language,'2026-11-07')])assert.ok(xml.includes(`<loc>${canonical+path}</loc>`));
    }
    const legacy=entries.find(e=>e.includes(`<loc>${canonical+newsPath('es',legacySlug)}</loc>`));assert.ok(legacy);assert.ok(!legacy.includes('hreflang="ru"'));assert.ok(!legacy.includes('hreflang="zh-Hans"'));
    for(const language of ['en','ru','zh-Hans'] as const)assert.ok(!xml.includes(`<loc>${canonical+newsPath(language,legacySlug)}</loc>`));
    for(const path of ['/ru/week/2026-11-01','/zh/week/2026-11-01','/editorial','/buscar','/search','?q=','?range='])assert.ok(!xml.includes(path),`Unexpected sitemap entry ${path}`);
    for(const item of [...drafts,future])assert.ok(!xml.includes(item.slug));
  });
  await check('unpublished/draft/future URLs remain404',async()=>{
    for(const language of languages)for(const item of [...drafts,future]){
      assert.equal((await fetch(origin+newsPath(language,item.slug))).status,404);
      assert.equal((await fetch(`${origin}/share/${language}/${item.slug}`)).status,404);
    }
    assert.equal((await fetch(origin+'/share/zh/'+slug)).status,404,'Release key is zh-Hans, not an invented language key');
  });
  assert.deepEqual(unexpected,[],'Only anonymous release REST reads are permitted');assert.ok(reads>0);
  console.log(JSON.stringify({passed:failures.length===0,checksPassed:passed.length,checks:passed,failures,anonymousFixtureReads:reads,productionDataModified:false,proofDirectory:process.env.SEO_PROOF_DIR??null},null,2));
  if(failures.length)throw new Error(`${failures.length} multilingual HTTP checks failed`);
}catch(error){console.error(diagnostics);throw error;}finally{
  if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit.catch(()=>{});}
  await new Promise<void>(resolveClose=>api.close(()=>resolveClose()));
}
