import {describe,it,expect} from 'vitest';
import {input,claims,articles,narration,articleKeys,pronunciation} from '../tools/demo/fixture';
import {svgCard,socialCard} from '../tools/demo/visuals';
import {readFileSync} from 'node:fs';
import {videoContentHash} from '@science/video';

describe('DEMO-001 honest synthetic evidence package',()=>{
 it('uses mathematically consistent invented data, without scientific verification or approvals',()=>{
  for(const series of [input.seriesA,input.seriesB])for(let i=1;i<series.length;i++)expect(series[i]).toBe(series[i-1]/2);
  expect(input.seriesA.map(v=>v/input.seriesA[0])).toEqual(input.seriesB.map(v=>v/input.seriesB[0]));
  expect(input.synthetic).toBe(true);expect(input.publicationEnabled).toBe(false);
  expect(claims.every(c=>c.status==='synthetic_arithmetic_only')).toBe(true);
 });
 it('keeps bilingual articles and every scene bound to known claims and explicit caveats',()=>{
  const ids=new Set(claims.map(c=>c.id));
  for(const article of articles()){
   expect(article.sections.map(s=>s.key)).toEqual(articleKeys);
   for(const section of article.sections)for(const p of section.paragraphs){expect(p.claimIds.length).toBeGreaterThan(0);expect(p.claimIds.every(id=>ids.has(id))).toBe(true);expect(p.caveatIds).toHaveLength(3);}
  }
  for(const [,text,,type,idsForScene] of narration){expect(text.length).toBeGreaterThan(20);expect(idsForScene.every(id=>ids.has(id))).toBe(true);expect(type).not.toBe('presenter');}
  expect(narration.find(s=>s[0]==='disclosure')?.[4]).toEqual(claims.map(c=>c.id));
 });
 it('changes one visual for the partial-render probe without changing narration or evidence',()=>{
  const mark=readFileSync('apps/web/public/brand/mark.svg').toString('base64');
  expect(svgCard('<unsafe>',0,mark)).toContain('&lt;unsafe&gt;');
  expect(svgCard('Demo',0,mark)).toContain('D / evidence axis');
  expect(svgCard('Demo',0,mark)).not.toContain('data:image/svg');
  expect(svgCard('Demo',0,mark,1080,1920)).toContain('width="1080" height="1920"');
  expect(socialCard(1280,720,mark,'YouTube')).toContain('NO PUBLICAR');
  const hash=videoContentHash({input,narration,articles:articles(),pronunciation});
  expect(videoContentHash({input,narration,articles:articles(),pronunciation})).toBe(hash);
 });
});
