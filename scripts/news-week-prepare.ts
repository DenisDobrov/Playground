/** Pure local adapter: research artifacts -> immutable NEWS packages. No model or network calls. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newsPackageSchema,type NewsPackage} from '@science/core';
import {preparationReviewState} from './news-week-validation';
const root=process.argv[2];if(!root)throw Error('Private preparation directory required');
const original=await readFile(root+'/original-request.txt','utf8');
const hash=createHash('sha256').update(original).digest('hex');
const langs=['es','en','ru','zh-Hans'] as const;
const headings={es:'Por qué importa',en:'Why it matters',ru:'Почему это важно','zh-Hans':'为什么重要'};
const text=(v:unknown):string=>typeof v==='string'?v:v===null||v===undefined?'':Array.isArray(v)?v.map(text).join(' '):JSON.stringify(v);
const date=(v:any):string|null=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:v?.date&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)?v.date:null;
const key=(l:string)=>l==='zh-Hans'?'zhHans':l;
const prepared:NewsPackage[]=[],manifest:any[]=[];
for(let number=1;number<=17;number++){
 const raw=JSON.parse(await readFile(`${root}/stories/${String(number).padStart(2,'0')}/story.json`,'utf8'));
 const sources=raw.sources.map((s:any)=>{
  const originalKind=text(s.kind),access=text(s.access),url=new URL(s.url);
  const kind=/preprint/i.test(originalKind)||/arxiv|biorxiv|researchsquare/.test(url.hostname)?'preprint':/journal|peer_reviewed/.test(originalKind)||/nature\.com|doi\.org/.test(url.hostname)?'journal':/vendor/.test(originalKind)||/ibm\.com|qunovacomputing|deepmind\.google|anthropic\.com/.test(url.hostname)?'vendor':/coverage/.test(originalKind)?'coverage':'institution';
  const level=/indexed.*(full|primary.*text)|full_text|full text|Full HTML/i.test(access)?'full_text':/403|429|451|unavailable|inaccessible|metadata|bibliographic|indexed_record/i.test(access)?'metadata_only':/abstract/i.test(access)?'abstract':kind==='vendor'||kind==='institution'?'announcement':/full_page|full/i.test(access)?'full_text':'metadata_only';
  return {url:s.url,title:s.title,kind,access:level,studyDate:date(s.studyDate),announcementDate:date(s.announcementDate),checkedAt:/T/.test(s.checkedAt)?s.checkedAt:s.checkedAt+'T00:00:00.000Z',finding:text(s.finding)+' Access record: '+access+'. Locator: '+text(s.preciseLocator??s.locator)};
 });
 const articles=Object.fromEntries(langs.map(l=>{const a=raw.articles[key(l)]??raw.articles[l];if(!a)throw Error(`Missing ${number}/${l}`);
  const {wordCount,...body}=a;const meta=raw.seo?.[key(l)]??a.seo??{title:a.title,description:a.paragraphs[0].slice(0,300)};
  return [l,{...body,seo:meta,tags:(raw.tags??[]).slice(0,12)}];
 }));
 const importance=(l:string)=>{const a=articles[l] as any;const i=a.blocks?.findIndex((b:any)=>b.type==='heading'&&b.text===headings[l as keyof typeof headings]);return i>=0?a.blocks.slice(i+1).slice(0,a.blocks.slice(i+1).findIndex((b:any)=>b.type==='heading')<0?undefined:a.blocks.slice(i+1).findIndex((b:any)=>b.type==='heading')).filter((b:any)=>b.type==='paragraph').map((b:any)=>b.text).join(' '):'';};
 const first=sources[0].url;
 const claims=raw.dossier.claims.map((c:any)=>{const ev=c.evidence?.[0],source=raw.sources.find((s:any)=>s.id===ev?.sourceId)?.url??c.sourceUrl??first;
  if(!c.type)throw Error(`Claim type required ${number}/${c.id}`);
  return {id:c.id,textEn:text(c.text??c.statement??c.textEn),type:c.type,source,locator:text(ev?.locator??c.locator),quantity:c.quantity===null?null:text(c.quantity),unit:c.units??c.unit??null,object:text(c.object),conditions:text(c.conditions),comparator:c.comparator===null?null:text(c.comparator),sample:c.sample===null?null:text(c.sample),uncertainty:c.uncertainty===null?null:text(c.uncertainty),limitations:text(c.limits??c.limitations)};
 });
 const eventDates=Object.entries({first_public:raw.eventDates.firstPublic,preprint:raw.eventDates.preprint,journal:raw.eventDates.journal,announcement:raw.eventDates.pressRelease,news_event:raw.eventDates.currentEvent}).map(([kind,v])=>({kind,date:date(v),source:(kind==='announcement'?sources.find((s:any)=>s.announcementDate===date(v)):kind==='preprint'||kind==='first_public'?sources.find((s:any)=>s.kind==='preprint'&&(s.studyDate===date(v)||s.announcementDate===date(v))):sources.find((s:any)=>s.kind==='journal'&&s.studyDate===date(v)))?.url??first,notes:typeof v==='object'?text(v):date(v)?'Date checked against the linked source record.':'Not established in the available sources.'}));
 const versions=raw.eventDates.preprintVersions??raw.eventDates.preprint?.versions??[];
 for(const version of versions)eventDates.push({kind:'preprint',date:date(version),source:sources.find((s:any)=>s.kind==='preprint')?.url??first,notes:text(version)});
 const review=raw.scientificReview,languageChecks=langs.map(language=>({language,status:preparationReviewState(raw.languageReviews?.[key(language)]??raw.languageReviews?.[language],'language'),method:'agent_consistency_check',notes:JSON.stringify(raw.languageReviews[key(language)]??raw.languageReviews[language])}));
 const sourceState=preparationReviewState(review,'source'),blocked=sourceState==='blocked'||languageChecks.some(c=>c.status==='blocked');
 const brief=raw.editorialBrief;
 const research:any={version:'news-003/1',eventDates,dossier:{summaryEn:text(brief.angle),claims,authorValidation:text(raw.dossier.authorValidation),externalVerification:text(raw.dossier.externalVerification),independent_verification:'not_performed'},sourceReview:{status:sourceState==='blocked'?'blocked':/limit|abstract|access/i.test(JSON.stringify(review))?'limited':'checked',method:'agent_source_meaning_check',findings:JSON.stringify(review),checkedAt:new Date(review.checkedAt??raw.checkedAt??sources[0].checkedAt).toISOString()},editorialBrief:{angle:text(brief.angle),audience:text(brief.audience),keyMessage:text(brief.keyMessage??brief.takeaway??brief.angle),importance:importance('en'),limitations:text(brief.doNotClaim??brief.prohibitedFramings??brief.mustAvoid??brief.limitations??(articles.en as any).limitations)},languageChecks,humanReview:'pending_exact_package_decision'};
 // The robot idea is prepared separately; its exact supported shape is reviewed before inclusion.
 if(raw.normalizedVideoBrief)research.videoBrief=raw.normalizedVideoBrief;
 const p=newsPackageSchema.parse({policy:'news-release/1',slug:raw.slug,eventKey:raw.eventKey,section:number,period:'2026-11-07/2026-11-14',...articles,sources,research,verification:{status:blocked?'blocked':'checked_summary',reason:text(review.safeScope??review.scope??review.findings??review.checks),independentScientificVerification:'not_performed'},changes:[],suggestions:{video:number===17,sciencePublication:false,videoReason:number===17?'Modular soft robots: a future editorial video idea with measured demonstrations and explicit teleoperation limits. No production is authorized.':'No video production requested for this story.',scienceReason:'No original research manuscript proposed.',provenance:'ai_suggested'},channelTexts:{telegram:{es:`${(articles.es as any).title}\n\n${(articles.es as any).paragraphs[0]}\n\nhttps://dobrov.org/noticias/${raw.slug}`,en:`${(articles.en as any).title}\n\n${(articles.en as any).paragraphs[0]}\n\nhttps://dobrov.org/en/news/${raw.slug}`}},provenance:{method:'codex_assisted_source_checked',modelApiCalls:0,sourceHash:hash}});
 prepared.push(p);manifest.push({number,slug:p.slug,eventKey:p.eventKey,canonicalIdentifiers:raw.canonicalIdentifiers,eventDates:raw.eventDates,review:p.research?.sourceReview.status,languageChecks:p.research?.languageChecks.map(c=>({language:c.language,status:c.status})),sourceHash:hash});
}
await writeFile(root+'/prepared-packages.json',JSON.stringify(prepared,null,2));await writeFile(root+'/preparation-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({packages:prepared.length,languageVersions:prepared.reduce((n,p)=>n+langs.filter(l=>p[l]).length,0),blocked:prepared.filter(p=>p.verification.status==='blocked').map(p=>p.section),sourceHash:hash,externalModelApiCalls:0}));
