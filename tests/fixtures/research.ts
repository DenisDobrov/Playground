import {researchSections,type ResearchDraft} from '@science/core';
export const researchText='The synthetic model predicts a bounded response. This is not an experiment.';
export function syntheticResearchDraft():ResearchDraft {
 return {planning:{angle:'Explain a synthetic model within its assumptions.',audience:'Synthetic test audience',whyMatters:'Test traceability only, not a real scientific conclusion.',novelty:'No real novelty asserted.',headline:'A bounded response in a synthetic model',backgroundExplanations:['Model versus experiment'],relatedConcepts:['Theoretical model'],potentialVisuals:['Original diagram; no external figures'],openQuestions:['Does the toy model describe nature?']},
 sections:Object.fromEntries(researchSections.map(k=>[k,[{text:'Synthetic fixture section: no real scientific finding.',claimKeys:[],provenance:'unknown'}]])) as unknown as ResearchDraft['sections'],
 evidence:[{key:'e1',page:1,quote:'The synthetic model predicts a bounded response.',section:'Synthetic model',context:'Synthetic test-only primary text.',numericalResults:'None reported.',limitations:'Not an experiment.'}],
 claims:[{key:'supported',textEn:'The toy model predicts a bounded response.',type:'theoretical_prediction',domainId:'physics',evidenceLevel:'P0',evidenceKeys:['e1'],caveatEn:'Synthetic model only.'},
 {key:'misleading',textEn:'The response was experimentally demonstrated.',type:'author_interpretation',domainId:'physics',evidenceLevel:'P0',evidenceKeys:['e1'],caveatEn:'INTENTIONAL NEGATIVE CONTROL: quote exists but does not imply an experiment.'},
 {key:'unsupported',textEn:'Commercial performance increased by 99%.',type:'speculation',domainId:'physics',evidenceLevel:'P0',evidenceKeys:[],caveatEn:'INTENTIONAL NEGATIVE CONTROL: no supporting evidence.'}]};
}
