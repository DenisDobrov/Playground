import {z} from 'zod';

export const articleSections=['scientific_question','background','methods','results','significance','limitations','remaining_questions','original_sources'] as const;
export const contentKinds=['article_es','article_en','script_es'] as const;
export type ContentKind=typeof contentKinds[number];
const paragraph=z.object({text:z.string().min(1).max(5000),claimIds:z.array(z.string().uuid()).max(30),caveatIds:z.array(z.string()).max(40)}).strict();
export const articleDraftSchema=z.object({title:z.string().min(1).max(300),language:z.enum(['es','en']),aiDisclosure:z.string().min(1).max(1000),sections:z.array(z.object({key:z.enum(articleSections),paragraphs:z.array(paragraph).min(1).max(12)}).strict()).length(8),unsupportedStatements:z.array(z.string().max(1000)).max(30)}).strict();
export const scriptDraftSchema=z.object({title:z.string().min(1).max(300),language:z.literal('es'),aiDisclosure:z.string().min(1).max(1000),scenes:z.array(z.object({id:z.string().regex(/^[a-z0-9-]{1,60}$/),type:z.enum(['scientific_diagram','research_evidence','concept_visualization','presenter_insert','scientific_caveat']),narrationEs:z.string().min(1).max(5000),sourceClaimIds:z.array(z.string().uuid()).max(30),caveatIds:z.array(z.string()).max(40),visualDescription:z.string().min(1).max(2000),explanatoryLabelEs:z.string().max(500),durationEstimateSeconds:z.number().int().min(1).max(120)}).strict()).min(4).max(30),unsupportedStatements:z.array(z.string().max(1000)).max(30)}).strict();
export type ArticleDraft=z.infer<typeof articleDraftSchema>;
export type SpanishScriptDraft=z.infer<typeof scriptDraftSchema>;
export interface ContentInput {
 schema:'content-input/1';inputHash:string;storyId:string;dossierId:string;dossierVersion:number;dossierHash:string;briefId:string;briefHash:string;approvalId:string;reviewIds:string[];
 brief:{approvedFindings:{claimId:string;text:string;reviewId:string;evidenceIds:string[]}[];mandatoryCaveats:string[];sourceReferences:{sourceId:string;url:string;version:string}[];[key:string]:unknown};
 dossier:unknown;evidence:{id:string;quote:string;numericalResults:string;locator:string;sourceId:string}[];
 document:{id:string;checksum:string;scope:string;version:string;rights:unknown};
 independentScientificVerification:'not_performed';
}
export function contentDraftIssues(kind:ContentKind,value:unknown,input:ContentInput):string[] {
 const parsed=(kind==='script_es'?scriptDraftSchema:articleDraftSchema).safeParse(value);
 if(!parsed.success)return ['schema_invalid'];
 const output=parsed.data,issues:string[]=[];
 if(output.language!==(kind==='article_en'?'en':'es'))issues.push('language_mismatch');
 if(output.unsupportedStatements.length)issues.push('model_reported_unsupported_statement');
 const findings=new Set(input.brief.approvedFindings.map(f=>f.claimId));
 const allowedCaveats=new Set(input.brief.mandatoryCaveats.map((_,i)=>'caveat-'+i));
 const rows='scenes' in output?output.scenes.map(s=>({text:s.narrationEs,claimIds:s.sourceClaimIds,caveatIds:s.caveatIds})):output.sections.flatMap(s=>s.paragraphs);
 const sourceText=[...input.brief.approvedFindings.map(f=>f.text),...input.evidence.flatMap(e=>[e.quote,e.numericalResults])].join(' ');
 const sourceNumbers=new Set((sourceText.match(/[0-9]+(?:[.,][0-9]+)?/g)||[]).map(s=>Number(s.replace(',','.'))));
 const numericRows='scenes' in output?rows:output.sections.filter(s=>s.key!=='original_sources').flatMap(s=>s.paragraphs);
 if(numericRows.some(r=>(r.text.match(/[0-9]+(?:[.,][0-9]+)?/g)||[]).some(s=>!sourceNumbers.has(Number(s.replace(',','.'))))))issues.push('unverified_quantity');
 for(const row of rows) {
  if(!row.claimIds.length)issues.push('unmapped_assertion');
  if(row.claimIds.some(id=>!findings.has(id)))issues.push('unapproved_claim');
  if(row.caveatIds.some(id=>!allowedCaveats.has(id)))issues.push('unknown_caveat');
 }
 const covered=new Set(rows.flatMap(r=>r.caveatIds));
 if([...allowedCaveats].some(id=>!covered.has(id)))issues.push('missing_mandatory_caveat');
 if('sections' in output) {
  if(new Set(output.sections.map(s=>s.key)).size!==8)issues.push('missing_article_section');
 } else {
  if(new Set(output.scenes.map(s=>s.id)).size!==output.scenes.length)issues.push('duplicate_scene');
  const main=output.scenes.filter(s=>s.type!=='presenter_insert'),claims=new Set(main.flatMap(s=>s.sourceClaimIds)),caveats=new Set(main.flatMap(s=>s.caveatIds));
  if([...findings].some(id=>!claims.has(id)))issues.push('main_video_missing_claim');
  if([...allowedCaveats].some(id=>!caveats.has(id)))issues.push('main_video_missing_caveat');
  for(const scene of output.scenes) {
   if(scene.type==='presenter_insert'&&(scene.durationEstimateSeconds>8||scene.sourceClaimIds.some(id=>!claims.has(id))||scene.caveatIds.some(id=>!caveats.has(id))))issues.push('presenter_not_optional');
   if(scene.type==='concept_visualization'&&!scene.explanatoryLabelEs.trim())issues.push('illustration_disclosure_required');
  }
  if(!main.some(s=>s.type==='scientific_caveat'))issues.push('caveat_scene_required');
  const duration=main.reduce((n,s)=>n+s.durationEstimateSeconds,0),total=output.scenes.reduce((n,s)=>n+s.durationEstimateSeconds,0);
  const words=main.map(s=>s.narrationEs).join(' ').trim().split(/\s+/u).length;
  if(duration<360||total>480||words<780||words>1200)issues.push('script_duration_estimate_outside_pilot');
 }
 return [...new Set(issues)];
}
