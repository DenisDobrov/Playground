import {domainPacks,dossierSchema,type ContentAsset,type DomainPack,type ResearchDossier,type ScientificStory,type Script} from './index';
/** Loaded from immutable, persisted scientific/brief approvals. Never accept this DTO from a browser as authority. */
export interface DossierVideoReleaseBundle {
 sourceKind:'reviewed_dossier';
 source:{story:ScientificStory;dossier:ResearchDossier;dossierId:string;dossierVersion:number;dossierInputHash:string;
  brief:{id:string;inputHash:string;dossierId:string;dossierVersion:number;preliminary:boolean};
  independentVerificationPassed:boolean;
  approval?:{id:string;actorId:string;approvedAt:string;dossierId:string;dossierVersion:number;dossierInputHash:string;briefId:string;briefInputHash:string}};
 script:Script;scriptInputHash:string;languageCheckPassed:boolean;assets:ContentAsset[];audioAssetIds:string[];renderSha256:string;
 approval?:{actorId:string;approvedAt:string;storyId:string;dossierId:string;dossierVersion:number;dossierInputHash:string;briefId:string;briefInputHash:string;scriptId:string;scriptVersion:number;scriptInputHash:string;renderSha256:string};
}
const sha=(s:string)=>/^[a-f0-9]{64}$/.test(s);
const actor=(a:{actorId:string;approvedAt:string}|undefined)=>!!a?.actorId.trim()&&Number.isFinite(Date.parse(a.approvedAt));
/** Direct dossier path: published article is optional; scientific, language, rights and exact-render approvals are not. */
export function dossierVideoPublicationIssues(b:DossierVideoReleaseBundle,packs:Record<string,DomainPack>=domainPacks):string[] {
 const {source:s,script,approval:a}=b;const issues:string[]=[];const d=s.dossier;const approval=s.approval;
 if(!dossierSchema.safeParse(d).success) issues.push('Invalid research dossier');
 if(d.storyId!==s.story.id||script.storyId!==s.story.id) issues.push('Story identity mismatch');
 if(!s.dossierId.trim()||!Number.isSafeInteger(s.dossierVersion)||s.dossierVersion<1||!sha(s.dossierInputHash)) issues.push('Exact dossier revision required');
 if(!s.story.domainIds.length||s.story.domainIds.some(id=>!packs[id])) issues.push('Unknown or missing domain');
 if(!s.independentVerificationPassed) issues.push('Independent verification required');
 if(s.brief.preliminary||!s.brief.id.trim()||!sha(s.brief.inputHash)||s.brief.dossierId!==s.dossierId||s.brief.dossierVersion!==s.dossierVersion) issues.push('Reviewed editorial brief required');
 if(!actor(approval)||!approval?.id.trim()||approval.dossierId!==s.dossierId||approval.dossierVersion!==s.dossierVersion||approval.dossierInputHash!==s.dossierInputHash||approval.briefId!==s.brief.id||approval.briefInputHash!==s.brief.inputHash) issues.push('Human approval for exact dossier and brief required');
 const claims=new Map(d.claims.map(c=>[c.id,c])),evidence=new Map(d.evidence.map(e=>[e.id,e]));
 if(claims.size!==d.claims.length||evidence.size!==d.evidence.length) issues.push('Duplicate claim or evidence identity');
 for(const c of d.claims) {
  if(!s.story.domainIds.includes(c.domainId)||!packs[c.domainId]?.evidenceLevels.includes(c.evidenceLevel)) issues.push('Invalid evidence scale: '+c.id);
  for(const id of c.evidenceIds) {const e=evidence.get(id);if(!e?.quote.trim()||!e.locator.trim()||!s.story.sourceIds.includes(e.sourceId)) issues.push('Missing provenance: '+c.id);}
 }
 if(!Number.isSafeInteger(script.version)||script.version<1||!script.scenes.length||!sha(b.scriptInputHash)) issues.push('Exact video script required');
 if(!b.languageCheckPassed||script.language!=='es') issues.push('Spanish video alignment check required');
 if(!sha(b.renderSha256)) issues.push('Final video checksum required');
 const assets=new Map(b.assets.map(x=>[x.id,x]));if(assets.size!==b.assets.length) issues.push('Duplicate asset identity');
 const asset=(id:string|undefined,kind?:ContentAsset['kind'])=>{const x=id?assets.get(id):undefined;if(!x?.path.trim()||!x.rightsCleared||!x.license?.trim()||!x.attribution.trim()||(kind&&x.kind!==kind)) issues.push('Uncleared asset rights: '+(id||'missing'));};
 for(const scene of script.scenes) {
  if(!scene.claimIds.length) issues.push('Unmapped published content');
  for(const id of scene.claimIds) {const c=claims.get(id);if(!c||!['verified','narrowed'].includes(c.status)||!c.evidenceIds.length) issues.push('Unsupported published claim: '+id);}
  if(!scene.narrationEs.trim()||!Number.isFinite(scene.durationSeconds)||scene.durationSeconds<=0) issues.push('Invalid scene: '+scene.id);
  if(scene.assetId||['real_asset','paper_figure'].includes(scene.visual)) asset(scene.assetId);
  if(scene.visual==='generated_illustration'&&!scene.illustrationLabelEs?.trim()) issues.push('Illustration label required: '+scene.id);
 }
 if(!b.audioAssetIds.length) issues.push('Licensed narration required');for(const id of b.audioAssetIds)asset(id,'audio');
 if(!actor(a)||a?.storyId!==s.story.id||a.dossierId!==s.dossierId||a.dossierVersion!==s.dossierVersion||a.dossierInputHash!==s.dossierInputHash||a.briefId!==s.brief.id||a.briefInputHash!==s.brief.inputHash||a.scriptId!==script.id||a.scriptVersion!==script.version||a.scriptInputHash!==b.scriptInputHash||a.renderSha256!==b.renderSha256) issues.push('Human approval for current video revisions required');
 return [...new Set(issues)];
}
