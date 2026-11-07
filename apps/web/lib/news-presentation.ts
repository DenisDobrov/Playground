import type {NewsPackage} from '@science/core';
import {newsTopics} from '@science/core';
import type {NewsRelease} from './news-seo';
export type NewsTopic=typeof newsTopics[number];
export type Language='en'|'es';
export const topics:Record<NewsTopic,{en:string;es:string}>={ai:{en:'AI',es:'IA'},'physics-space':{en:'Physics & space',es:'Física y espacio'},quantum:{en:'Quantum',es:'Cuántica'},'origins-life':{en:'Origins of life',es:'Origen de la vida'},brain:{en:'Brain',es:'Cerebro'},longevity:{en:'Longevity',es:'Longevidad'},'energy-technology':{en:'Energy & technology',es:'Energía y tecnología'}};
export function topicOf(article:NewsPackage['en'],slug=''):NewsTopic {
  if(article.topic)return article.topic;
  const text=foldText(slug+' '+article.title);
  if(/longevity|senescen|rapamycin|rapamicina|survival/.test(text))return 'longevity';
  if(/brain|cerebr|psilocybin|psilocibina|cogniti|child-speech/.test(text))return 'brain';
  if(/coacerv|protocel|origins|vesicul/.test(text))return 'origins-life';
  if(/quantum|cuant|qubit|cubit/.test(text))return 'quantum';
  if(/mast-upgrade|fusion|fluoride|membran|battery|electrolyte/.test(text))return 'energy-technology';
  if(/pulsar|black-hole|horizon|superconduct|physics|galax/.test(text))return 'physics-space';
  return 'ai';
}
export function foldText(text:string){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
export function readingMinutes(article:NewsPackage['en']){const tableWords=article.blocks?.filter(b=>b.type==='table').map(b=>b.type==='table'?[b.caption,...b.headers,...b.rows.flat(),b.note].join(' '):'').join(' ')??'';return Math.max(1,Math.ceil((article.paragraphs.join(' ')+' '+tableWords+' '+article.limitations).trim().split(/\s+/).length/220));}
export const queryText=(value:unknown)=>typeof value==='string'?value.trim().slice(0,200):'';
export const hasTopic=(r:NewsRelease,topic:string)=>topicOf(r.content.article,r.slug)===topic||r.content.article.secondaryTopics?.includes(topic as NewsTopic)===true;
export const publicListingPath=(lang:Language,kind:'news'|'analysis'|'topics'|'search'|'archive')=>lang==='en'?`/en/${kind}`:({news:'/noticias',analysis:'/analisis',topics:'/temas',search:'/buscar',archive:'/archivo'}[kind]);
export const topicPath=(lang:Language,topic:NewsTopic)=>`${publicListingPath(lang,'topics')}/${topic}`;
export function translatedPath(path:string,language:Language):string {
  if(path.startsWith('/editorial')||path==='/login')return language==='en'?'/en':'/';
  const pairs=[['/','/en'],['/politica','/en/method'],['/noticias','/en/news'],['/analisis','/en/analysis'],['/temas','/en/topics'],['/buscar','/en/search'],['/archivo','/en/archive'],['/semana/2026-11-01','/en/week/2026-11-01']];
  for(const [es,en] of pairs){if(path===es||path===en)return language==='en'?en:es;}
  for(const [es,en] of pairs.filter(p=>p[0]!=='/')){if(path.startsWith(es+'/'))return(language==='en'?en:es)+path.slice(es.length);if(path.startsWith(en+'/'))return(language==='en'?en:es)+path.slice(en.length);}
  return language==='en'?'/en':'/';
}
export function orderedNews(rows:NewsRelease[],language:Language){return rows.filter(r=>r.language===language).sort((a,b)=>(b.first_published_at??b.published_at).localeCompare(a.first_published_at??a.published_at)||a.slug.localeCompare(b.slug));}
export function filterNews(rows:NewsRelease[],options:{query?:string;topic?:string;type?:string;window?:string;now?:number}) {
  const words=foldText((options.query??'').slice(0,200)).trim().split(/\s+/).filter(Boolean);
  const since=options.window==='week'?(options.now??Date.now())-7*86400000:options.window==='month'?(options.now??Date.now())-30*86400000:0;
  return rows.filter(r=>{
    const a=r.content.article;if(options.topic&&!hasTopic(r,options.topic))return false;
    if(options.type&&a.type!==options.type)return false;
    if(since&&Date.parse(r.first_published_at??r.published_at)<since)return false;
    const haystack=foldText(a.title+' '+a.paragraphs.join(' ')+' '+a.limitations);return words.every(word=>haystack.includes(word));
  });
}
export function pageNumber(value:string|undefined){return Math.min(10000,Math.max(1,Number.isSafeInteger(Number(value))?Number(value):1));}
