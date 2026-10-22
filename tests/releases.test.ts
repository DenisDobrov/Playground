import { describe, expect, it } from 'vitest';
import { demoBundle } from '@science/core/demo';
import { articlePublicationIssues, videoPublicationIssues, type ArticleReleaseBundle, type VideoReleaseBundle } from '@science/core';
import { planSceneRenders, type RenderSettings, type SceneRenderInput } from '@science/video';

function article(): ArticleReleaseBundle {
  const b = structuredClone(demoBundle);
  b.dossier.claims.forEach(c => { c.status = 'verified'; });
  return { story: b.story, dossier: b.dossier, dossierVersion: 1, article: b.article,
    languageCheckPassed: true, independentVerificationPassed: true,
    approval: { actorId: 'editor', approvedAt: '2026-10-22T10:00:00Z', storyId: b.story.id, articleId: b.article.id, articleVersion: b.article.version, dossierVersion: 1 } };
}
function video(): VideoReleaseBundle {
  const source = article(); const script = structuredClone(demoBundle.script);
  return { source, script, languageCheckPassed: true, renderSha256: 'a'.repeat(64),
    publishedArticle: { articleId: source.article.id, articleVersion: source.article.version, dossierVersion: 1, publishedAt: '2026-10-22T11:00:00Z' },
    assets: [{ id: 'voice', kind: 'audio', path: 'private/voice.wav', sourceUrl: null, license: 'licensed-synthetic-voice', attribution: 'Voice provider', rightsCleared: true, generated: true }], audioAssetIds: ['voice'],
    approval: { actorId: 'editor', approvedAt: '2026-10-22T12:00:00Z', renderSha256: 'a'.repeat(64), storyId: source.story.id, scriptId: script.id, scriptVersion: script.version, articleId: source.article.id, articleVersion: source.article.version, dossierVersion: 1 } };
}
describe('independent release contracts', () => {
  it('allows an approved article without any script, audio or video approval', () => expect(articlePublicationIssues(article())).toEqual([]));
  it('holds video with missing audio while the article remains releasable', () => {
    const b = video(); b.audioAssetIds = [];
    expect(videoPublicationIssues(b)).toContain('Licensed narration required');
    expect(articlePublicationIssues(b.source)).toEqual([]);
  });
  it('requires the exact published article revision', () => {
    const b = video(); b.publishedArticle.articleVersion++;
    expect(videoPublicationIssues(b)).toContain('Published article revision required');
  });
  it('invalidates both approvals when the dossier changes', () => {
    const b = video(); b.source.dossierVersion++;
    expect(articlePublicationIssues(b.source)).toContain('Human approval for current article and dossier required');
    expect(videoPublicationIssues(b)).toContain('Human approval for current video revisions required');
  });
  it('invalidates video approval after script regeneration', () => {
    const b = video(); b.script.version++;
    expect(videoPublicationIssues(b)).toContain('Human approval for current video revisions required');
    expect(articlePublicationIssues(b.source)).toEqual([]);
  });
  it('requires per-asset rights even for generated audio or diagram assets', () => {
    const b = video(); b.assets[0].license = null;
    b.script.scenes[0].assetId = 'diagram';
    expect(videoPublicationIssues(b)).toContain('Uncleared asset rights: voice');
    expect(videoPublicationIssues(b)).toContain(`Uncleared asset rights: ${b.script.scenes[0].id}`);
  });
  it('does not accept fabricated claims or empty dossiers', () => {
    const b = article(); b.dossier.claims = []; b.dossier.evidence = [];
    expect(articlePublicationIssues(b)).toContain('Invalid research dossier');
    expect(articlePublicationIssues(b)).toContain('Unsupported published claim: claim-demo');
  });
  it('accepts a separately reviewed complete video contract', () => expect(videoPublicationIssues(video())).toEqual([]));
  it('requires a new approval if the final MP4 changes without a script change', () => {
    const b = video(); b.renderSha256 = 'b'.repeat(64);
    expect(videoPublicationIssues(b)).toContain('Human approval for current video revisions required');
  });
});

const digest = (c: string) => c.repeat(64);
const settings: RenderSettings = { rendererBuildHash: digest('a'), styleHash: digest('b'), fontsHash: digest('c'), pronunciationVersion: 'es/1', voiceVersion: 'voice/1', width: 1920, height: 1080, fps: 30 };
const inputs = (): SceneRenderInput[] => structuredClone(demoBundle.script.scenes).map(scene => ({ scene, scientificDataHash: digest('d'), assetHashes: [], audioHash: digest('e') }));
describe('scene job planning', () => {
  it('produces stable identities across retries', () => expect(planSceneRenders(inputs(), settings)).toEqual(planSceneRenders(inputs(), settings)));
  it('changes only the corrected scene and final assembly', () => {
    const original = inputs(); const before = planSceneRenders(original, settings);
    original[0].scene.narrationEs += ' Corrección.';
    const after = planSceneRenders(original, settings);
    expect(after.scenes[0].inputHash).not.toBe(before.scenes[0].inputHash);
    expect(after.scenes.slice(1)).toEqual(before.scenes.slice(1));
    expect(after.assemblyKey).not.toBe(before.assemblyKey);
  });
  it('reuses scene identities when reordered but changes assembly', () => {
    const before = planSceneRenders(inputs(), settings); const after = planSceneRenders(inputs().reverse(), settings);
    expect(after.scenes).toEqual([...before.scenes].reverse());
    expect(after.assemblyKey).not.toBe(before.assemblyKey);
  });
  it('invalidates renders when pronunciation, fonts or underlying assets change', () => {
    const before = planSceneRenders(inputs(), settings);
    expect(planSceneRenders(inputs(), { ...settings, pronunciationVersion: 'es/2' }).scenes[0].inputHash).not.toBe(before.scenes[0].inputHash);
    expect(planSceneRenders(inputs(), { ...settings, fontsHash: digest('f') }).scenes[0].inputHash).not.toBe(before.scenes[0].inputHash);
    const changed = inputs(); changed[0].assetHashes = [digest('f')];
    expect(planSceneRenders(changed, settings).scenes[0].inputHash).not.toBe(before.scenes[0].inputHash);
  });
  it('fails closed on absent input digests and duplicate scene IDs', () => {
    const bad = inputs(); bad[0].audioHash = '';
    expect(() => planSceneRenders(bad, settings)).toThrow('hashes');
    const duplicate = inputs(); duplicate.push(duplicate[0]);
    expect(() => planSceneRenders(duplicate, settings)).toThrow('Unique');
  });
});
