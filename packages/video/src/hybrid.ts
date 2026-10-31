import {videoContentHash} from './scene-plan';
export type HybridSceneType='scientific_diagram'|'research_evidence'|'concept_visualization'|'presenter_insert'|'scientific_caveat';
export type PresenterMode='still_motion'|'facial_motion'|'talking_portrait'|'recorded_video';
export interface AssetRef {id:string;version:number;contentHash:string}
export interface HumanArtifactApproval {actorId:string;approvedAt:string;inputHash:string;outputHash:string}
export interface LikenessConsent {
 id:string;ownerId:string;grantedBy:string;sourceFileHash:string;scriptRevisionIds:string[];
 uses:(PresenterMode|'voice_clone')[];grantedAt:string;expiresAt:string|null;revokedAt:string|null;
 allowTraining:false;allowUnrelatedReuse:false;
}
export interface MediaAssetRevision extends AssetRef {
 assetType:'scientific_visual'|'presenter_photo'|'presenter_segment'|'narration_audio'|'recorded_video';
 ownerId:string|null;sourceFileHash:string;privatePath:string;originalPrivate:boolean;
 consent:LikenessConsent|null;generator:{provider:string;model:string;parametersVersion:string;inputHash:string}|null;
 generatedVideoHash:string|null;syntheticLikeness:boolean;voiceSource:'none'|'licensed_tts'|'original_recording'|'authorized_voice_clone';
 rightsStatus:'pending'|'cleared'|'rejected';license:string|null;attribution:string;disclosureRequired:boolean;
 createdAt:string;durationSeconds:number|null;approval:HumanArtifactApproval|null;
}
export interface HybridScene {
 id:string;type:HybridSceneType;scriptRevisionId:string;scriptInputHash:string;narrationEs:string;sourceClaimIds:string[];
 requiredCaveats:string[];visualAssets:AssetRef[];audioAsset:AssetRef|null;duration:number;
 explanatoryLabelEs:string|null;presenterMode:PresenterMode|null;
 scientificReview:{inputHash:string;status:'pending'|'approved';reviewId?:string;actorId?:string;approvedAt?:string};
 visualReview:HumanArtifactApproval|null;outputHash:string|null;
}
export interface VoiceRevision {
 language:'es';locale:string;voiceId:string;pronunciationVersion:string;scriptRevisionId:string;
 scriptInputHash:string;textHash:string;audioHash:string;actualDuration:number;provider:string;
 receipt:string;actualMicros:number;
}
export interface HybridPlanInput {
 mode:'technical_preview'|'pilot';scriptRevisionId:string;scriptInputHash:string;
 dossierInputHash:string;briefInputHash:string;claims:{id:string;contentHash:string;requiredCaveats:string[]}[];
 scenes:HybridScene[];assets:MediaAssetRevision[];voice:VoiceRevision|null;
 renderer:{buildHash:string;styleHash:string;fontsHash:string;width:number;height:number;fps:number};
}
const sha=(s:string)=>/^[a-f0-9]{64}$/.test(s);
const positive=(n:number)=>Number.isFinite(n)&&n>0;
const same=(a:AssetRef,b:AssetRef)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
function approval(a:HumanArtifactApproval|null,inputHash:string,outputHash:string) {return !!a?.actorId.trim()&&Number.isFinite(Date.parse(a.approvedAt))&&a.inputHash===inputHash&&a.outputHash===outputHash;}
/** Consent/rights checks apply before any provider call or deterministic movement of a real owner's image. */
export function mediaAssetIssues(asset:MediaAssetRevision,scriptRevisionId:string,mode:PresenterMode|null,now:string):string[] {
 const issues:string[]=[];if(!Number.isFinite(Date.parse(now))) throw new Error('Explicit review time required');
 if(!asset.id.trim()||!Number.isSafeInteger(asset.version)||asset.version<1||!sha(asset.contentHash)||!sha(asset.sourceFileHash)||!Number.isFinite(Date.parse(asset.createdAt))) issues.push('Invalid asset revision');
 if(!asset.privatePath.trim()||/^https?:/i.test(asset.privatePath)||asset.privatePath.split(/[\\/]/).includes('..')) issues.push('Private storage path required');
 if(asset.rightsStatus!=='cleared'||!asset.license?.trim()||!asset.attribution.trim()) issues.push('Asset rights not cleared');
 if(asset.syntheticLikeness&&!asset.ownerId) issues.push('Owner identity required');
 if(asset.voiceSource==='authorized_voice_clone'&&!asset.ownerId) issues.push('Explicit personal voice cloning consent required');
 if(asset.ownerId) {
  if(!asset.originalPrivate) issues.push('Personal originals must remain private');
  const c=asset.consent;
  if(!c||!c.id.trim()||c.ownerId!==asset.ownerId||c.grantedBy!==asset.ownerId||c.sourceFileHash!==asset.sourceFileHash||!c.scriptRevisionIds.includes(scriptRevisionId)||c.allowTraining!==false||c.allowUnrelatedReuse!==false||c.revokedAt!==null||!Number.isFinite(Date.parse(c.grantedAt))||Date.parse(c.grantedAt)>Date.parse(now)||(c.expiresAt!==null&&(!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=Date.parse(now)))||(mode&&!c.uses.includes(mode))) issues.push('Current scoped owner consent required');
  if(asset.voiceSource==='authorized_voice_clone'&&!c?.uses.includes('voice_clone')) issues.push('Explicit personal voice cloning consent required');
  if(['presenter_photo','recorded_video'].includes(asset.assetType)&&!approval(asset.approval,asset.sourceFileHash,asset.contentHash)) issues.push('Source presenter asset approval required');
 }
 if((asset.syntheticLikeness||(asset.ownerId&&asset.voiceSource!=='none'&&asset.voiceSource!=='original_recording'))&&!asset.disclosureRequired) issues.push('Synthetic presenter/voice disclosure required');
 if(asset.assetType==='presenter_segment') {
  if(!asset.generator?.provider.trim()||!asset.generator.model.trim()||!asset.generator.parametersVersion.trim()||!sha(asset.generator.inputHash)||asset.generatedVideoHash!==asset.contentHash||!positive(asset.durationSeconds||0)) issues.push('Generated presenter provenance required');
  if(!approval(asset.approval,asset.generator?.inputHash||'',asset.contentHash)) issues.push('Generated presenter segment approval required');
 }
 return issues;
}
export function sceneScientificHash(scene:HybridScene,input:Pick<HybridPlanInput,'dossierInputHash'|'briefInputHash'|'claims'>) {
 return videoContentHash({contract:'scene-science/1',claims:[...scene.sourceClaimIds].sort().map(id=>({id,contentHash:input.claims.find(c=>c.id===id)?.contentHash})),caveats:scene.requiredCaveats,narrationEs:scene.narrationEs});
}
/** Presenter scenes are optional; only main scenes may carry unique scientific content/caveats. */
export function planHybridVideo(input:HybridPlanInput,presenterEnabled:boolean,now:string) {
 if(!input.scenes.length||new Set(input.scenes.map(s=>s.id)).size!==input.scenes.length||new Set(input.claims.map(c=>c.id)).size!==input.claims.length||new Set(input.assets.map(a=>a.id)).size!==input.assets.length) throw new Error('Unique scene/claim/asset identities required');
 if(![input.scriptInputHash,input.dossierInputHash,input.briefInputHash,input.renderer.buildHash,input.renderer.styleHash,input.renderer.fontsHash,...input.claims.map(c=>c.contentHash)].every(sha)||!input.scriptRevisionId.trim()) throw new Error('Resolved immutable input hashes required');
 const r=input.renderer;if(![r.width,r.height,r.fps].every(Number.isSafeInteger)||r.width<16||r.width>4096||r.height<16||r.height>4096||r.width%2||r.height%2||r.fps<1||r.fps>60) throw new Error('Bounded even render dimensions/fps required');
 const main=input.scenes.filter(s=>s.type!=='presenter_insert');const mainClaims=new Set(main.flatMap(s=>s.sourceClaimIds)),mainCaveats=new Set(main.flatMap(s=>s.requiredCaveats));
 for(const claim of input.claims) if(!mainClaims.has(claim.id)||claim.requiredCaveats.some(c=>!mainCaveats.has(c))) throw new Error('Main video must retain every required claim and caveat');
 if(input.claims.some(c=>c.requiredCaveats.length)&&!main.some(s=>s.type==='scientific_caveat')) throw new Error('Dedicated scientific caveat scene required');
 for(const claim of input.claims) for(const caveat of claim.requiredCaveats) if(!main.some(s=>s.type==='scientific_caveat'&&s.sourceClaimIds.includes(claim.id)&&s.requiredCaveats.includes(caveat))) throw new Error('Dedicated caveat must retain its supporting claim and limitation');
 const scenes=input.scenes.filter(s=>presenterEnabled||s.type!=='presenter_insert');let cursor=0;
 const planned=scenes.map(scene=>{
  if(!['scientific_diagram','research_evidence','concept_visualization','presenter_insert','scientific_caveat'].includes(scene.type)||scene.scriptRevisionId!==input.scriptRevisionId||scene.scriptInputHash!==input.scriptInputHash||!scene.narrationEs.trim()||!positive(scene.duration)||scene.duration>120||scene.sourceClaimIds.some(id=>!input.claims.some(c=>c.id===id))) throw new Error('Invalid scene or scientific reference');
  if(scene.type!=='presenter_insert'&&!scene.sourceClaimIds.length) throw new Error('Scientific scene must reference claims');
  if(scene.type==='presenter_insert'&&(scene.duration>8||!scene.presenterMode||scene.sourceClaimIds.some(id=>!mainClaims.has(id))||scene.requiredCaveats.some(c=>!mainCaveats.has(c)))) throw new Error('Presenter must be short and scientifically optional');
  if(scene.type==='concept_visualization'&&!scene.explanatoryLabelEs?.trim()) throw new Error('Explanatory visual label required');
  const refs=[...scene.visualAssets,...(scene.audioAsset?[scene.audioAsset]:[])];
  if(scene.type==='presenter_insert') {
   const visuals=scene.visualAssets.map(ref=>input.assets.find(a=>same(a,ref)));
   if(!visuals.some(a=>a?.ownerId&&((scene.presenterMode==='still_motion'&&a.assetType==='presenter_photo')||(scene.presenterMode==='recorded_video'&&a.assetType==='recorded_video')||a.assetType==='presenter_segment'))) throw new Error('Approved owner presenter visual required');
   if((input.voice||visuals.some(a=>a?.syntheticLikeness))&&!scene.explanatoryLabelEs?.trim()) throw new Error('Presenter/synthetic narration disclosure required');
  }
  for(const ref of refs) {const asset=input.assets.find(a=>same(a,ref));if(!asset) throw new Error('Asset revision mismatch');const errors=mediaAssetIssues(asset,scene.scriptRevisionId,scene.presenterMode,now);if(errors.length) throw new Error(errors.join('; '));}
  // Global dossier/script IDs, timeline position and review timestamps bind approvals, not pixels.
  // Only affected claim/evidence fingerprints and resolved scene media invalidate a render cache entry.
  const inputHash=videoContentHash({contract:'hybrid-scene/1',scene:{type:scene.type,narrationEs:scene.narrationEs,requiredCaveats:scene.requiredCaveats,duration:scene.duration,explanatoryLabelEs:scene.explanatoryLabelEs,presenterMode:scene.presenterMode},scientific:sceneScientificHash(scene,input),assets:refs.map(ref=>{const a=input.assets.find(a=>same(a,ref))!;return {contentHash:a.contentHash,sourceFileHash:a.sourceFileHash,generator:a.generator,syntheticLikeness:a.syntheticLikeness,voiceSource:a.voiceSource,disclosureRequired:a.disclosureRequired};}),voice:input.voice?{locale:input.voice.locale,voiceId:input.voice.voiceId,pronunciationVersion:input.voice.pronunciationVersion,provider:input.voice.provider}:null,renderer:r});
  const result={...scene,startTime:cursor,inputHash,rightsStatus:'cleared' as const,visualReviewStatus:scene.outputHash&&approval(scene.visualReview,inputHash,scene.outputHash)?'approved' as const:'pending' as const};cursor+=scene.duration;return result;
 });
 if(input.mode==='pilot'&&(cursor<360||cursor>480||r.width!==1920||r.height!==1080)) throw new Error('Pilot requires 6–8 minutes at 1920×1080');
 return {contract:'hybrid-timeline/1',mode:input.mode,scenes:planned,duration:cursor,presenterEnabled,assemblyInputHash:videoContentHash({renderer:r,order:planned.map(s=>({id:s.id,startTime:s.startTime,inputHash:s.inputHash})),voice:input.voice})};
}
export function hybridReleaseIssues(input:HybridPlanInput,presenterEnabled:boolean,now:string):string[] {
 const issues:string[]=[];let plan:ReturnType<typeof planHybridVideo>;
 try{plan=planHybridVideo(input,presenterEnabled,now);}catch(e){return [e instanceof Error?e.message:'Invalid video plan'];}
 if(input.mode!=='pilot') issues.push('Technical preview is not a scientific pilot');
 const v=input.voice;
 if(!v||v.language!=='es'||!v.locale.startsWith('es')||!v.voiceId.trim()||!v.pronunciationVersion.trim()||v.scriptRevisionId!==input.scriptRevisionId||v.scriptInputHash!==input.scriptInputHash||![v.audioHash,v.textHash].every(sha)||!positive(v.actualDuration)||!v.provider.trim()||!v.receipt.trim()||!Number.isSafeInteger(v.actualMicros)||v.actualMicros<0) issues.push('Licensed metered Spanish narration revision required');
 for(const s of plan.scenes) {
  if(!s.audioAsset||!input.assets.some(a=>same(a,s.audioAsset!)&&a.assetType==='narration_audio'&&positive(a.durationSeconds||0)&&Math.abs(a.durationSeconds!-s.duration)<=1/input.renderer.fps)) issues.push('Scene narration asset required: '+s.id);
  if(s.scientificReview.status!=='approved'||!s.scientificReview.reviewId?.trim()||!s.scientificReview.actorId?.trim()||!Number.isFinite(Date.parse(s.scientificReview.approvedAt||''))||s.scientificReview.inputHash!==sceneScientificHash(s,input)) issues.push('Scientific scene review required: '+s.id);
  if(!s.outputHash||!sha(s.outputHash)||!approval(s.visualReview,s.inputHash,s.outputHash)) issues.push('Exact scene output review required: '+s.id);
 }
 if(v&&Math.abs(v.actualDuration-plan.duration)>1/input.renderer.fps) issues.push('Actual narration timings must match assembled scenes');
 return [...new Set(issues)];
}
/** Cache reuse requires input identity AND actual output bytes; approval is re-evaluated separately. */
export function canReuseScene(cached:{inputHash:string;outputHash:string},expectedInputHash:string,actualOutputHash:string) {return sha(actualOutputHash)&&cached.inputHash===expectedInputHash&&cached.outputHash===actualOutputHash;}
export interface PresenterAnimationProvider {
 readonly id:string;
 generate(input:{asset:MediaAssetRevision;mode:PresenterMode;scriptRevisionId:string;scriptSegmentHash:string;audioHash:string|null;parametersVersion:string;operationId:string}):Promise<{privatePath:string;outputHash:string;actualDuration:number;receipt:string;actualMicros:number;usage:Record<string,number>}>;
}
