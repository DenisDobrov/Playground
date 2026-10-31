import {describe,it,expect} from 'vitest';
import {demoBundle} from '@science/core/demo';
import {videoPublicationIssues,type DossierVideoReleaseBundle} from '@science/core';
const h=(c='a')=>c.repeat(64);
function fixture():DossierVideoReleaseBundle {
 const b=structuredClone(demoBundle);b.dossier.claims.forEach(c=>c.status='verified');
 const ref={dossierId:'dossier-1',dossierVersion:1,dossierInputHash:h(),briefId:'brief-1',briefInputHash:h('b')};
 return {sourceKind:'reviewed_dossier',source:{story:b.story,dossier:b.dossier,dossierId:ref.dossierId,dossierVersion:1,dossierInputHash:ref.dossierInputHash,brief:{id:ref.briefId,inputHash:ref.briefInputHash,dossierId:ref.dossierId,dossierVersion:1,preliminary:false},independentVerificationPassed:true,approval:{id:'source-approval',actorId:'fixture-human',approvedAt:'2026-10-30T00:00:00Z',...ref}},script:b.script,scriptInputHash:h('c'),renderSha256:h('d'),languageCheckPassed:true,assets:[{id:'voice',kind:'audio',path:'private/voice.wav',sourceUrl:null,license:'fixture-licensed',attribution:'Fixture',rightsCleared:true,generated:true}],audioAssetIds:['voice'],approval:{actorId:'fixture-human',approvedAt:'2026-10-30T00:00:00Z',storyId:b.story.id,...ref,scriptId:b.script.id,scriptVersion:b.script.version,scriptInputHash:h('c'),renderSha256:h('d')}};
}
describe('video release from reviewed dossier without a web article',()=>{
 it('accepts a separately approved direct dossier path without inventing an article/publication',()=>{const b=fixture();expect(b).not.toHaveProperty('publishedArticle');expect(videoPublicationIssues(b)).toEqual([]);});
 it('preserves independent science, evidence, Spanish alignment and exact source/brief approval gates',()=>{
 const mutations=[(b:DossierVideoReleaseBundle)=>{b.source.independentVerificationPassed=false;},(b:DossierVideoReleaseBundle)=>{b.source.dossier.claims[0].status='unverified';},(b:DossierVideoReleaseBundle)=>{b.languageCheckPassed=false;},(b:DossierVideoReleaseBundle)=>{b.source.brief.preliminary=true;},(b:DossierVideoReleaseBundle)=>{b.source.dossierInputHash=h('f');},(b:DossierVideoReleaseBundle)=>{b.source.brief.inputHash=h('f');}];
 for(const mutate of mutations){const b=fixture();mutate(b);expect(videoPublicationIssues(b).length).toBeGreaterThan(0);}
 });
 it('invalidates final approval when script, dossier, brief or MP4 changes and still requires narration rights',()=>{
 for(const mutate of [(b:DossierVideoReleaseBundle)=>{b.scriptInputHash=h('e');},(b:DossierVideoReleaseBundle)=>{b.renderSha256=h('e');},(b:DossierVideoReleaseBundle)=>{b.script.version++;},(b:DossierVideoReleaseBundle)=>{b.source.dossierVersion++;}]){const b=fixture();mutate(b);expect(videoPublicationIssues(b)).toContain('Human approval for current video revisions required');}
 const b=fixture();b.assets[0].rightsCleared=false;expect(videoPublicationIssues(b)).toContain('Uncleared asset rights: voice');
 });
});
