import {z} from 'zod';
export const researchSections=['scientificQuestion','background','methodology','mainFindings','quantitativeResults','supportingEvidence','limitations','alternativeInterpretations','demonstrated','unknowns','significance','openQuestions','sourceReferences'] as const;
const statement=z.object({text:z.string().min(1).max(4000),claimKeys:z.array(z.string()).max(30),provenance:z.enum(['source_supported','author_interpretation','ai_explanation','unknown','disputed'])});
export const researchDraftSchema=z.object({
 planning:z.object({angle:z.string().min(1).max(2000),audience:z.string().min(1).max(500),whyMatters:z.string().min(1).max(2000),novelty:z.string().min(1).max(2000),headline:z.string().min(1).max(500),backgroundExplanations:z.array(z.string().min(1).max(2000)).max(20),relatedConcepts:z.array(z.string().min(1).max(300)).max(20),potentialVisuals:z.array(z.string().min(1).max(2000)).max(20),openQuestions:z.array(z.string().min(1).max(2000)).max(20)}),
 sections:z.object(Object.fromEntries(researchSections.map(k=>[k,z.array(statement).min(1).max(30)])) as Record<typeof researchSections[number],z.ZodArray<typeof statement>>),
 evidence:z.array(z.object({key:z.string().regex(/^[a-z0-9-]{1,60}$/),page:z.number().int().min(1).max(40),quote:z.string().min(1).max(1500),section:z.string().max(200),context:z.string().min(1).max(2000),numericalResults:z.string().max(2000),limitations:z.string().min(1).max(2000)})).max(50),
 claims:z.array(z.object({key:z.string().regex(/^[a-z0-9-]{1,60}$/),textEn:z.string().min(1).max(3000),type:z.enum(['measured_result','author_interpretation','theoretical_prediction','editorial_explanation','speculation']),domainId:z.enum(['ai','physics']),evidenceLevel:z.string().max(10),evidenceKeys:z.array(z.string()).max(50),caveatEn:z.string().min(1).max(2000)})).min(1).max(30)
});
export type ResearchDraft=z.infer<typeof researchDraftSchema>;
/** Exact extraction is a mechanical check, never a verdict on the claim's scientific meaning. */
export function validateResearchDraft(input:unknown,pages:string[],domain:'ai'|'physics') {
 const draft=researchDraftSchema.parse(input);
 if(new Set(draft.claims.map(c=>c.key)).size!==draft.claims.length||new Set(draft.evidence.map(e=>e.key)).size!==draft.evidence.length) throw new Error('Duplicate identity');
 const evidence=new Set(draft.evidence.map(e=>e.key)),claims=new Set(draft.claims.map(c=>c.key));
 for(const e of draft.evidence) if(!pages[e.page-1]?.includes(e.quote)) throw new Error('Quote does not occur on the stated page');
 for(const c of draft.claims) if(c.domainId!==domain||!((domain==='physics'?['P0','P1','P2','P3','P-']:['A0','A1','A2','A3','A-']).includes(c.evidenceLevel))||c.evidenceKeys.some(k=>!evidence.has(k))) throw new Error('Invalid claim policy or evidence');
 for(const entries of Object.values(draft.sections)) for(const s of entries) if(s.claimKeys.some(k=>!claims.has(k))||(s.provenance==='source_supported'&&!s.claimKeys.length)) throw new Error('Unmapped dossier statement');
 return draft;
}
