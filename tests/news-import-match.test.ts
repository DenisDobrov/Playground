import {describe,it,expect} from 'vitest';
import {canonicalNewsIdentity as id,resolveNewsIdentity} from '../scripts/news-import-match';
describe('canonical news vs reused context',()=>{
 it('keeps a Carbon context citation from merging a separate Hydrogen event, including replay',()=>{
  const carbon={id:'carbon',slug:'carbon',direct:false,first_source:'https://example.org/carbon'};
  const hydrogen={id:'hydrogen',slug:'hydrogen',direct:true,first_source:'https://example.org/hydrogen'};
  expect(resolveNewsIdentity([carbon],[id('https://example.org/hydrogen')])).toEqual({story:null,contextMatches:['carbon']});
  expect(resolveNewsIdentity([carbon,hydrogen],[id('https://example.org/hydrogen')])).toEqual({story:hydrogen,contextMatches:['carbon']});
 });
 it('matches DOI/arXiv versions and stops contradictory canonical identities',()=>{
  expect(id('https://arxiv.org/html/2604.03381v2')).toBe(id('2604.03381'));
  expect(id('https://doi.org/10.3390/Universe12070193')).toBe('doi:10.3390/universe12070193');
  const a={id:'a',slug:'a',direct:false,first_source:'https://arxiv.org/abs/2604.03381v1'};
  expect(resolveNewsIdentity([a],[id('2604.03381')]).story).toBe(a);
  expect(()=>resolveNewsIdentity([a,{...a,id:'b'}],[id('2604.03381')])).toThrow('CONFLICT');
 });
 it('matches intake without a news package and leaves an event-only overview separate',()=>{
  const intake={id:'a',slug:'a',direct:false,first_source:null};
  expect(resolveNewsIdentity([intake],[id('2604.03381')]).story).toBe(intake);
  const context={...intake,first_source:'https://example.org/robot'};
  expect(resolveNewsIdentity([context],[]).story).toBeNull();
  expect(()=>id('http://example.org')).toThrow();
 });
});
