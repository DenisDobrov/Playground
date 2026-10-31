import {describe,it,expect} from 'vitest';
import {validateResearchDraft} from '@science/core';
import {syntheticResearchDraft,researchText} from './fixtures/research';
describe('SCI-003 evidence integrity',()=>{
 it('preserves unsupported claims and labels a matched quotation separately from scientific meaning',()=>{
 const d=validateResearchDraft(syntheticResearchDraft(),[researchText],'physics');expect(d.claims).toHaveLength(3);expect(d.claims[2].evidenceKeys).toHaveLength(0);expect(d.claims[1].evidenceKeys).toEqual(['e1']);
 });
 it('rejects invented quotations and page numbers, even when the claim sounds plausible',()=>{
 for(const change of [(d:ReturnType<typeof syntheticResearchDraft>)=>d.evidence[0].quote='Invented quotation.',(d:ReturnType<typeof syntheticResearchDraft>)=>d.evidence[0].page=2]) {const d=syntheticResearchDraft();change(d);expect(()=>validateResearchDraft(d,[researchText],'physics')).toThrow();}
 });
 it('requires complete sections, distinct identities, mapped evidence and domain-specific scales',()=>{
 const changes=[(d:ReturnType<typeof syntheticResearchDraft>)=>{d.sections.methodology=[];},(d:ReturnType<typeof syntheticResearchDraft>)=>{d.claims.push(d.claims[0]);},(d:ReturnType<typeof syntheticResearchDraft>)=>{d.claims[0].evidenceKeys=['missing'];},(d:ReturnType<typeof syntheticResearchDraft>)=>{d.claims[0].evidenceLevel='A3';},(d:ReturnType<typeof syntheticResearchDraft>)=>{d.sections.background=[{text:'Unmapped supported narrative',provenance:'source_supported',claimKeys:[]}];}];
 for(const change of changes) {const d=syntheticResearchDraft();change(d);expect(()=>validateResearchDraft(d,[researchText],'physics')).toThrow();}
 });
});
