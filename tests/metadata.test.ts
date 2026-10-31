import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {metadataEndpoint,parsePrimaryMetadata,metadataHash,relationshipEvidence,boundedMetadataRequest} from '@science/sources';
const xml=readFileSync('tests/fixtures/metadata/arxiv.xml','utf8');
const json=readFileSync('tests/fixtures/metadata/crossref.json','utf8');
const arxiv=()=>parsePrimaryMetadata('arxiv:9910.00001',xml),doi=()=>parsePrimaryMetadata('doi:10.9999/sci002-fixture',json);
describe('SCI-002 primary metadata adapters',()=>{
 it('retains primary dates, authors, abstract, categories, version, DOI and journal independently',()=>{
 const m=arxiv();expect(m.authors).toEqual(['Ada Example','Ben Sample']);expect(m.version).toBe(3);
 expect(m.dates.initialPublished).toBe('1999-10-01T00:00:00.000Z');expect(m.dates.updated).toBe('2026-10-01T00:00:00.000Z');
 expect(m.doi).toBe('doi:10.9999/sci002-fixture');expect(m.categories).toHaveLength(2);expect(m.abstract).toContain('Synthetic');expect(m.journal).toContain('2026');expect(m.scientificStatus).toBe('unverified');
 });
 it('preserves partial publication dates, created/indexed distinctions, relations and corrections',()=>{
 const m=doi();expect(m.dates.published).toEqual({'date-parts':[[2026,10,1]]});expect(m.dates['published-online']).toEqual({'date-parts':[[2026,9]]});
 expect(m.dates.created).not.toEqual(m.dates.published);expect(m.dates.indexed).toBeTruthy();expect(m.relations['is-preprint-of']).toBeTruthy();expect(m.updates).toHaveLength(1);expect(m.scientificStatus).toBe('unverified');
 });
 it('retains journal issue/publication fields and bounds normalized provider data',()=>{
 const raw=JSON.parse(json);Object.assign(raw.message,{publisher:'Synthetic Publisher',type:'journal-article',volume:'12',issue:'3',page:'1-9',ISSN:['9999-9999']});
 expect(parsePrimaryMetadata('doi:10.9999/sci002-fixture',JSON.stringify(raw)).publication).toMatchObject({publisher:'Synthetic Publisher',volume:'12',issue:'3',page:'1-9'});
 raw.message.abstract='x'.repeat(262144);expect(()=>parsePrimaryMetadata('doi:10.9999/sci002-fixture',JSON.stringify(raw))).toThrow(/limits/);
 expect(()=>parsePrimaryMetadata('arxiv:9910.00001',xml.replace('10.9999/sci002-fixture','arxiv:9910.00002'))).toThrow(/DOI/);
 });
 it('requires exact returned identity, complete arXiv fields and bounded safe formats',()=>{
 for(const [id,raw] of [['arxiv:9910.00002',xml],['arxiv:9910.00001','<feed/>'],['arxiv:9910.00001',xml.replace('<author>','<not-author>')],['doi:10.9999/other',json],['doi:10.9999/sci002-fixture','{}']]) expect(()=>parsePrimaryMetadata(id,raw)).toThrow();
 for(const bad of ['<!DOCTYPE feed>'+xml,'<feed>','x'.repeat(2_000_001)]) expect(()=>parsePrimaryMetadata('arxiv:9910.00001',bad)).toThrow();
 expect(()=>parsePrimaryMetadata('doi:10.9999/sci002-fixture','<html>bad</html>')).toThrow();
 });
 it('does not invent publication dates or a version history',()=>{
 const raw=JSON.parse(json);delete raw.message.published;delete raw.message.issued;delete raw.message['published-online'];
 const m=parsePrimaryMetadata('doi:10.9999/sci002-fixture',JSON.stringify(raw));expect(m.dates.published).toBeUndefined();expect(m.version).toBeNull();
 expect(arxiv()).not.toHaveProperty('versions');expect(metadataHash(xml)).toBe(metadataHash(xml));expect(metadataHash(xml+' ')).not.toBe(metadataHash(xml));
 });
 it('requires explicit relationship plus independent metadata; similarity alone never links',()=>{
 expect(relationshipEvidence(arxiv(),doi()).eligible).toBe(true);
 expect(relationshipEvidence({...arxiv(),doi:null},doi()).eligible).toBe(false);
 expect(relationshipEvidence(arxiv(),{...doi(),title:'Unrelated black hole publication'}).warnings).toContain('title_disagreement');
 expect(relationshipEvidence(arxiv(),{...doi(),authors:[]}).warnings).toContain('authors_disagree_or_missing');
 });
 it('constructs only approved endpoints and encodes DOI path characters',async()=>{
 expect(metadataEndpoint('https://arxiv.org/pdf/9910.00001v3.pdf').identity).toBe('arxiv:9910.00001');
 expect(metadataEndpoint('10.9999/path?query#fragment').url).toContain('10.9999%2Fpath%3Fquery%23fragment');
 for(const s of ['https://evil.example/x','http://127.0.0.1','doi:garbage']) expect(()=>metadataEndpoint(s)).toThrow();
 for(const url of ['https://127.0.0.1/','https://api.crossref.org/private','https://export.arxiv.org/pdf/test','https://api.crossref.org:443@evil.example/works/test']) await expect(boundedMetadataRequest(url,'json')).rejects.toThrow();
 });
});
