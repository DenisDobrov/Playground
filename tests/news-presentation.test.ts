import {describe,it,expect} from 'vitest';
import {filterNews,orderedNews,translatedPath,queryText,hasTopic} from '../apps/web/lib/news-presentation';
import {catalogSelection,type NewsCatalogEntry} from '../apps/web/lib/news-catalog';
import {newsFixture} from './fixtures/news';
import type {NewsRelease} from '../apps/web/lib/news-seo';
function release():NewsRelease {const p=newsFixture('a'.repeat(64));return {id:'fixture',story_id:'fixture',package_id:'fixture',language:'es',slug:'quantum',published_at:'2026-11-07T12:00:00Z',first_published_at:'2026-10-01T12:00:00Z',content:{article:{...p.es,title:'Computación cuántica: energía',topic:'quantum',secondaryTopics:['energy-technology'],sourcePublicationMonth:'2026-06'},sources:p.sources,verification:p.verification,section:1,period:'standalone:2026-11-07'}};}
describe('publication navigation and private video catalog',()=>{
 it('preserves exact translated article/category paths',()=>{
  expect(translatedPath('/noticias/quantum','en')).toBe('/en/news/quantum');expect(translatedPath('/en/news/quantum','es')).toBe('/noticias/quantum');
  expect(translatedPath('/en/topics/quantum','es')).toBe('/temas/quantum');expect(translatedPath('/editorial/news','en')).toBe('/en');
 });
 it('searches accents and filters by editorial first publication, not study or latest approval date',()=>{
  const r=release();expect(filterNews([r],{query:'cuantica energia'})).toHaveLength(1);expect(filterNews([r],{query:'owner-secret-comment'})).toHaveLength(0);
  expect(hasTopic(r,'energy-technology')).toBe(true);expect(filterNews([r],{window:'week',now:Date.parse('2026-11-07')})).toHaveLength(0);
  expect(orderedNews([r,{...r,id:'new',first_published_at:'2026-11-07T12:00:00Z'}],'es')[0].id).toBe('new');expect(queryText(['a','b'])).toBe('');
 });
 it('includes decided video ideas, keeps counts and paginates without using private comments as search content',()=>{
  const entries:NewsCatalogEntry[]=Array.from({length:25},(_,i)=>({story_id:String(i),package_id:String(i),decision:i===0?null:'approve',suggested_video:true,suggested_science:false,package:{en_title:'Quantum story '+i,es_title:'Historia cuántica '+i,slug:'story-'+i}}));
  const page=catalogSelection(entries,{view:'video',q:'cuantica',page:'2'});expect(page.videoCount).toBe(25);expect(page.count).toBe(25);expect(page.items).toHaveLength(12);expect(page.items[0].package_id).toBe('12');
  expect(catalogSelection(entries,{}).items).toHaveLength(1);expect(catalogSelection(entries,{view:'all',q:'missing'}).count).toBe(0);
  expect(catalogSelection(entries,{view:'video',page:'9999999'}).page).toBe(3);
 });
});
