import {describe,it,expect} from 'vitest';
import {planHybridVideo,hybridReleaseIssues,mediaAssetIssues,canReuseScene,sceneScientificHash,panFallbackArgs,type MediaAssetRevision,type HybridPlanInput,type HybridScene} from '@science/video';
const h=(s='a')=>s.repeat(64),now='2026-10-31T08:00:00Z';
function asset(id='graphic'):MediaAssetRevision {return {id,version:1,contentHash:h(),assetType:'scientific_visual',ownerId:null,sourceFileHash:h(),privatePath:'technical/graphic.ppm',originalPrivate:true,consent:null,generator:null,generatedVideoHash:null,syntheticLikeness:false,voiceSource:'none',rightsStatus:'cleared',license:'project-original',attribution:'Synthetic technical test card',disclosureRequired:false,createdAt:'2026-10-30T00:00:00Z',durationSeconds:null,approval:null};}
function portrait():MediaAssetRevision {const a=asset('owner');return {...a,assetType:'presenter_photo',ownerId:'owner',consent:{id:'consent-1',ownerId:'owner',grantedBy:'owner',sourceFileHash:a.sourceFileHash,scriptRevisionIds:['script-1'],uses:['still_motion'],grantedAt:'2026-10-30T00:00:00Z',expiresAt:null,revokedAt:null,allowTraining:false,allowUnrelatedReuse:false},approval:{actorId:'owner',approvedAt:'2026-10-30T01:00:00Z',inputHash:a.sourceFileHash,outputHash:a.contentHash}};}
function input():HybridPlanInput {
 const a=asset();const scene=(id:string,claim:string,type:HybridScene['type']='scientific_diagram'):HybridScene=>({id,type,scriptRevisionId:'script-1',scriptInputHash:h('b'),narrationEs:'Demostración técnica sintética.',sourceClaimIds:[claim],requiredCaveats:type==='scientific_caveat'?['Synthetic limitation']:[],visualAssets:[{id:a.id,version:a.version,contentHash:a.contentHash}],audioAsset:null,duration:2,explanatoryLabelEs:null,presenterMode:null,scientificReview:{inputHash:h('c'),status:'pending'},visualReview:null,outputHash:null});
 return {mode:'technical_preview',scriptRevisionId:'script-1',scriptInputHash:h('b'),dossierInputHash:h('c'),briefInputHash:h('d'),claims:[{id:'c1',contentHash:h('1'),requiredCaveats:['Synthetic limitation']},{id:'c2',contentHash:h('2'),requiredCaveats:[]}],scenes:[scene('one','c1'),scene('two','c2'),scene('limits','c1','scientific_caveat')],assets:[a],voice:null,renderer:{buildHash:h('3'),styleHash:h('4'),fontsHash:h('5'),width:1920,height:1080,fps:30}};
}
describe('hybrid scientific video foundation',()=>{
 it('keeps main science/caveats complete with every presenter insert disabled',()=>{
  const p=input(),a=portrait();p.assets.push(a);p.scenes.push({...p.scenes[0],id:'intro-owner',type:'presenter_insert',presenterMode:'still_motion',visualAssets:[a],duration:4});
  expect(planHybridVideo(p,true,now).duration).toBe(10);expect(planHybridVideo(p,false,now).duration).toBe(6);
  p.claims.push({id:'owner-only',contentHash:h('6'),requiredCaveats:[]});p.scenes[3].sourceClaimIds=['owner-only'];expect(()=>planHybridVideo(p,true,now)).toThrow(/Main video/);
 });
 it('requires a dedicated caveat scene and blocks missing claim/caveat coverage',()=>{
  const p=input();p.scenes[2].type='scientific_diagram';expect(()=>planHybridVideo(p,false,now)).toThrow(/Dedicated/);
  p.scenes[2].type='scientific_caveat';p.scenes[2].requiredCaveats=[];expect(()=>planHybridVideo(p,false,now)).toThrow(/caveat/);
  p.scenes[0].requiredCaveats=['Synthetic limitation'];expect(()=>planHybridVideo(p,false,now)).toThrow(/Dedicated caveat/);
 });
 it('revalidates scoped owner consent, revocation, training restrictions and source approval',()=>{
  const a=portrait();expect(mediaAssetIssues(a,'script-1','still_motion',now)).toEqual([]);
  for(const edit of [(x:MediaAssetRevision)=>{x.consent!.revokedAt=now;},(x:MediaAssetRevision)=>{x.consent!.expiresAt=now;},(x:MediaAssetRevision)=>{x.consent!.sourceFileHash=h('f');},(x:MediaAssetRevision)=>{x.consent!.scriptRevisionIds=['other'];},(x:MediaAssetRevision)=>{(x.consent as any).allowTraining=true;},(x:MediaAssetRevision)=>{x.approval=null;}]) {const bad=structuredClone(a);edit(bad);expect(mediaAssetIssues(bad,'script-1','still_motion',now).length).toBeGreaterThan(0);}
  expect(mediaAssetIssues(a,'script-1','talking_portrait',now)).toContain('Current scoped owner consent required');
 });
 it('requires explicit voice-clone consent and synthesized-speech disclosure',()=>{
  const a=portrait();a.voiceSource='authorized_voice_clone';expect(mediaAssetIssues(a,'script-1','still_motion',now)).toContain('Explicit personal voice cloning consent required');
  a.voiceSource='licensed_tts';expect(mediaAssetIssues(a,'script-1','still_motion',now)).toContain('Synthetic presenter/voice disclosure required');
 });
 it('requires approved generated presenter output and provenance for reuse',()=>{
  const a=portrait();a.assetType='presenter_segment';a.generator={provider:'synthetic-test',model:'fake-fixture',parametersVersion:'1',inputHash:h('7')};a.generatedVideoHash=a.contentHash;a.durationSeconds=4;a.approval=null;
  expect(mediaAssetIssues(a,'script-1','still_motion',now)).toContain('Generated presenter segment approval required');
  a.approval={actorId:'reviewer',approvedAt:'2026-10-30T00:00:00Z',inputHash:h('7'),outputHash:a.contentHash};expect(mediaAssetIssues(a,'script-1','still_motion',now)).toEqual([]);
 });
 it('invalidates only affected scene caches; global revisions/reordering still invalidate assembly/approval',()=>{
  const p=input(),before=planHybridVideo(p,false,now);p.claims[0].contentHash=h('9');p.dossierInputHash=h('8');p.briefInputHash=h('7');p.scriptInputHash=h('6');p.scenes.forEach(s=>s.scriptInputHash=p.scriptInputHash);
  const after=planHybridVideo(p,false,now);expect(after.scenes[0].inputHash).not.toBe(before.scenes[0].inputHash);expect(after.scenes[1].inputHash).toBe(before.scenes[1].inputHash);expect(after.scenes[2].inputHash).not.toBe(before.scenes[2].inputHash);
  p.scenes.reverse();const reordered=planHybridVideo(p,false,now);expect(reordered.scenes.map(s=>s.inputHash).sort()).toEqual(after.scenes.map(s=>s.inputHash).sort());expect(reordered.assemblyInputHash).not.toBe(after.assemblyInputHash);
  expect(canReuseScene({inputHash:'expected',outputHash:h()},'expected',h())).toBe(true);expect(canReuseScene({inputHash:'expected',outputHash:h()},'expected',h('b'))).toBe(false);
 });
 it('holds previews and unreviewed/voiceless plans at the release boundary',()=>{
  const p=input();expect(hybridReleaseIssues(p,false,now)).toContain('Technical preview is not a scientific pilot');expect(hybridReleaseIssues(p,false,now)).toContain('Licensed metered Spanish narration revision required');
  p.mode='pilot';expect(()=>planHybridVideo(p,false,now)).toThrow(/6–8 minutes/);
 });
 it('checks exact rendered outputs, Spanish voice timing, input-specific scientific and visual reviews',()=>{
  const p=input();p.mode='pilot';p.scenes.forEach((s,i)=>{s.duration=120;const audio={...asset('audio-'+i),assetType:'narration_audio' as const,contentHash:h(String(i+1)),durationSeconds:120,voiceSource:'licensed_tts' as const};p.assets.push(audio);s.audioAsset=audio;s.scientificReview={inputHash:sceneScientificHash(s,p),status:'approved',reviewId:'synthetic-review',actorId:'synthetic-human',approvedAt:'2026-10-30T00:00:00Z'};});
  p.voice={language:'es',locale:'es-ES',voiceId:'fixture',pronunciationVersion:'lexicon-1',scriptRevisionId:p.scriptRevisionId,scriptInputHash:p.scriptInputHash,textHash:h('9'),audioHash:h('8'),actualDuration:360,provider:'synthetic-fixture',receipt:'not-a-real-charge',actualMicros:0};
  const plan=planHybridVideo(p,false,now);p.scenes.forEach((s,i)=>{s.outputHash=h('e');s.visualReview={actorId:'synthetic-human',approvedAt:'2026-10-30T00:00:00Z',inputHash:plan.scenes[i].inputHash,outputHash:s.outputHash};});expect(hybridReleaseIssues(p,false,now)).toEqual([]);
  p.scenes[0].outputHash=h('f');expect(hybridReleaseIssues(p,false,now)).toContain('Exact scene output review required: one');
  p.voice.actualDuration=359;expect(hybridReleaseIssues(p,false,now)).toContain('Actual narration timings must match assembled scenes');
 });
 it('bounds deterministic camera movement, duration and render dimensions',()=>{
  const s={width:1920,height:1080,fps:30,duration:3,zoomTo:1.04};const args=panFallbackArgs('input.ppm','output.mp4',s);expect(args).toContain('-an');expect(args).toContain('libx264');expect(args).toContain('file,pipe');
  for(const bad of [{...s,zoomTo:2},{...s,duration:30},{...s,width:99999},{...s,fps:Infinity}])expect(()=>panFallbackArgs('in','out',bad)).toThrow();
 });
});
