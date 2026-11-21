import {describe,it,expect} from 'vitest';
import {knowledgeQuery,knowledgeUrl,knowledgeSourceUrl,knowledgeDecisionInput,contextDecisionState,type KnowledgeRecord,type KnowledgeDecision} from '../../packages/core/src/knowledge';
describe('private knowledge navigation and exact context',()=>{
 it('bounds untrusted query inputs and preserves literal search',()=>{
  expect(knowledgeQuery({page:'1e99',kind:'admin',package:'javascript:bad',entry:['bad'],q:'  50%_α  '})).toMatchObject({page:1,kind:'all',package:'',entry:'',q:'50%_α'});
  expect(knowledgeQuery({q:'x'.repeat(500),page:'99999999'})).toMatchObject({q:'x'.repeat(200),page:100000});
  expect(knowledgeUrl({q:'a&b + ε',history:true,page:2})).toBe('/editorial/knowledge?q=a%26b+%2B+%CE%B5&history=1&page=2');
 });
 it('never renders active untrusted protocols or URL credentials',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.org','//example.org','http://example.org',null])expect(knowledgeSourceUrl(value)).toBeNull();
  expect(knowledgeSourceUrl('https://doi.org/10.1000/test')).toBe('https://doi.org/10.1000/test');
 });
 it('requires exact current source and package revisions for a saved link',()=>{
  const entry={record_hash:'a'.repeat(64),is_current:true} as KnowledgeRecord;
  const decision={package_id:'current',record_hash:entry.record_hash,decision:'accept'} as KnowledgeDecision;
  expect(contextDecisionState(decision,entry,'current')).toBe('accept');
  for(const [value,packageId]of [[null,'current'],[{...entry,is_current:false},'current'],[{...entry,record_hash:'b'.repeat(64)},'current'],[entry,'new']] as const)expect(contextDecisionState(decision,value,packageId)).toBe('stale');
 });
 it('rejects forged structure but allows an empty owner comment',()=>{
  const input={package:'f1234567-1234-4123-8123-123456789012',entry:'source:fixture',hash:'a'.repeat(64),previous:null,request:'a1234567-1234-4123-8123-123456789012',decision:'accept',comment:''};
  expect(knowledgeDecisionInput.safeParse(input).success).toBe(true);
  expect(knowledgeDecisionInput.safeParse({...input,hash:'tampered'}).success).toBe(false);
  expect(knowledgeDecisionInput.safeParse({...input,comment:'x'.repeat(4001)}).success).toBe(false);
 });
});
