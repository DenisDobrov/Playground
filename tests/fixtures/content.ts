import {articleSections,type ContentInput,type ArticleDraft,type SpanishScriptDraft} from '@science/core';
export const contentClaim='11111111-1111-4111-8111-111111111111';
export function contentInputFixture():ContentInput {
 return {schema:'content-input/1',inputHash:'a'.repeat(64),storyId:'22222222-2222-4222-8222-222222222222',dossierId:'33333333-3333-4333-8333-333333333333',dossierVersion:1,dossierHash:'b'.repeat(64),briefId:'44444444-4444-4444-8444-444444444444',briefHash:'c'.repeat(64),approvalId:'55555555-5555-4555-8555-555555555555',reviewIds:['66666666-6666-4666-8666-666666666666'],brief:{approvedFindings:[{claimId:contentClaim,text:'Synthetic model only, not an experiment.',reviewId:'66666666-6666-4666-8666-666666666666',evidenceIds:[]}],mandatoryCaveats:['Synthetic fixture, never a real scientific acceptance.'],sourceReferences:[{sourceId:'77777777-7777-4777-8777-777777777777',url:'https://arxiv.org/abs/9912.00001',version:'v1'}]},dossier:{synthetic:true},evidence:[],document:{id:'88888888-8888-4888-8888-888888888888',checksum:'d'.repeat(64),scope:'full_text',version:'v1',rights:{mediaReuse:'not_cleared'}},independentScientificVerification:'not_performed'};
}
export function contentArticleFixture(input=contentInputFixture(),language:'es'|'en'='es'):ArticleDraft {
 const id=input.brief.approvedFindings[0].claimId;
 return {title:'Synthetic article fixture',language,aiDisclosure:'Synthetic offline fixture, not a scientific pilot.',sections:articleSections.map(key=>({key,paragraphs:[{text:language==='es'?'Texto sintético para probar el contrato, no un hallazgo científico.':'Synthetic contract test text, not a scientific finding.',claimIds:[id],caveatIds:input.brief.mandatoryCaveats.map((_,i)=>'caveat-'+i)}]})),unsupportedStatements:[]};
}
export function contentScriptFixture(input=contentInputFixture()):SpanishScriptDraft {
 const words=Array(210).fill('sintético').join(' ');
 return {title:'Synthetic script fixture',language:'es',aiDisclosure:'Synthetic test only.',scenes:Array.from({length:4},(_,i)=>({id:'scene-'+i,type:i===3?'scientific_caveat':'scientific_diagram',narrationEs:words,sourceClaimIds:input.brief.approvedFindings.map(f=>f.claimId),caveatIds:input.brief.mandatoryCaveats.map((_,n)=>'caveat-'+n),visualDescription:'Original synthetic test diagram; no asset supplied.',explanatoryLabelEs:'',durationEstimateSeconds:90})),unsupportedStatements:[]};
}
