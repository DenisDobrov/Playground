import { domainPacks, dossierSchema, type Article, type ContentAsset, type DomainPack, type ResearchDossier, type ScientificStory, type Script } from './index';
import { localizedArticleSchema, type LocalizedArticle } from './localized-article';

export interface ArticleApproval {
  language?: 'es' | 'en';
  actorId: string; approvedAt: string; storyId: string;
  articleId: string; articleVersion: number; dossierVersion: number;
}
export interface ArticleReleaseBundle {
  story: ScientificStory; dossier: ResearchDossier; dossierVersion: number; article: Article | LocalizedArticle;
  languageReviewLanguage?: 'es' | 'en';
  independentVerificationPassed: boolean; languageCheckPassed: boolean;
  approval?: ArticleApproval;
}
export interface PublishedArticle {
  articleId: string; articleVersion: number; dossierVersion: number; publishedAt: string;
}
export interface VideoApproval {
  actorId: string; approvedAt: string; storyId: string;
  renderSha256: string;
  scriptId: string; scriptVersion: number; articleId: string; articleVersion: number; dossierVersion: number;
}
export interface VideoReleaseBundle {
  source: ArticleReleaseBundle; publishedArticle: PublishedArticle; script: Script;
  assets: ContentAsset[]; audioAssetIds: string[];
  renderSha256: string;
  languageCheckPassed: boolean; approval?: VideoApproval;
}
const validVersion = (v: number) => Number.isSafeInteger(v) && v > 0;
const validActor = (a: { actorId: string; approvedAt: string } | undefined) => Boolean(a?.actorId.trim() && Number.isFinite(Date.parse(a.approvedAt)));

function contentIssues(bundle: ArticleReleaseBundle, packs: Record<string, DomainPack>): string[] {
  const { story, dossier, article } = bundle;
  const issues: string[] = [];
  if ('aiDisclosure' in article && (!localizedArticleSchema.safeParse(article).success || article.dossierVersion !== bundle.dossierVersion)) issues.push('Invalid localized article revision');
  if (!dossierSchema.safeParse(dossier).success) issues.push('Invalid research dossier');
  if (dossier.storyId !== story.id || article.storyId !== story.id) issues.push('Story identity mismatch');
  if (!validVersion(bundle.dossierVersion) || !validVersion(article.version)) issues.push('Invalid revision');
  if (!story.domainIds.length || story.domainIds.some(id => !packs[id])) issues.push('Unknown or missing domain');
  if (!bundle.independentVerificationPassed) issues.push('Independent verification required');
  if (!bundle.languageCheckPassed || (bundle.languageReviewLanguage || 'es') !== article.language) issues.push('Target language claim alignment check required');
  if (!article.title.trim() || !article.paragraphs.length) issues.push('Article content required');
  if (!('aiDisclosure' in article ? article.aiDisclosure : article.aiDisclosureEs).trim()) issues.push('AI disclosure required');
  const evidence = new Map(dossier.evidence.map(e => [e.id, e]));
  if (evidence.size !== dossier.evidence.length || new Set(dossier.claims.map(c => c.id)).size !== dossier.claims.length) issues.push('Duplicate claim or evidence identity');
  for (const claim of dossier.claims) {
    if (!story.domainIds.includes(claim.domainId) || !packs[claim.domainId]?.evidenceLevels.includes(claim.evidenceLevel)) issues.push(`Invalid evidence scale: ${claim.id}`);
    for (const id of claim.evidenceIds) {
      const ev = evidence.get(id);
      if (!ev || !ev.quote.trim() || !ev.locator.trim() || !story.sourceIds.includes(ev.sourceId)) issues.push(`Missing provenance: ${claim.id}`);
    }
  }
  for (const paragraph of article.paragraphs) {
    if (!('text' in paragraph ? paragraph.text : paragraph.textEs).trim()) issues.push('Empty article paragraph');
    issues.push(...referenceIssues(paragraph.claimIds, dossier));
  }
  return issues;
}
function referenceIssues(ids: string[], dossier: ResearchDossier): string[] {
  if (!ids.length) return ['Unmapped published content'];
  const claims = new Map(dossier.claims.map(c => [c.id, c]));
  return ids.flatMap(id => {
    const c = claims.get(id);
    return !c || !['verified', 'narrowed'].includes(c.status) || !c.evidenceIds.length ? [`Unsupported published claim: ${id}`] : [];
  });
}

/** Pure contract only: server must load trusted reviews and authenticated approvals from storage. */
export function articlePublicationIssues(bundle: ArticleReleaseBundle, packs = domainPacks): string[] {
  const issues = contentIssues(bundle, packs);
  const a = bundle.approval;
  if (!validActor(a) || !a || (a.language || 'es') !== bundle.article.language || a.storyId !== bundle.story.id || a.articleId !== bundle.article.id || a.articleVersion !== bundle.article.version || a.dossierVersion !== bundle.dossierVersion) issues.push('Human approval for current article and dossier required');
  return [...new Set(issues)];
}

/** Video failure never participates in the article gate. Publication reference must be persisted server-side. */
export function videoPublicationIssues(bundle: VideoReleaseBundle, packs = domainPacks): string[] {
  const { source, script, publishedArticle: p, approval: a } = bundle;
  const issues = contentIssues(source, packs);
  if (!/^[a-f0-9]{64}$/.test(bundle.renderSha256)) issues.push('Final video checksum required');
  if (p.articleId !== source.article.id || p.articleVersion !== source.article.version || p.dossierVersion !== source.dossierVersion || !Number.isFinite(Date.parse(p.publishedAt))) issues.push('Published article revision required');
  if (script.storyId !== source.story.id) issues.push('Story identity mismatch');
  if (!validVersion(script.version) || !script.scenes.length) issues.push('Video script required');
  if (!bundle.languageCheckPassed) issues.push('Spanish video alignment check required');
  const assets = new Map(bundle.assets.map(asset => [asset.id, asset]));
  if (assets.size !== bundle.assets.length) issues.push('Duplicate asset identity');
  const checkAsset = (id: string | undefined, label: string, kind?: ContentAsset['kind']) => {
    const asset = id ? assets.get(id) : undefined;
    if (!asset || !asset.path.trim() || !asset.rightsCleared || !asset.license?.trim() || !asset.attribution.trim() || (kind && asset.kind !== kind)) issues.push(`Uncleared asset rights: ${label}`);
  };
  for (const scene of script.scenes) {
    issues.push(...referenceIssues(scene.claimIds, source.dossier));
    if (!scene.narrationEs.trim() || !Number.isFinite(scene.durationSeconds) || scene.durationSeconds <= 0) issues.push(`Invalid scene: ${scene.id}`);
    if (scene.assetId || ['real_asset', 'paper_figure'].includes(scene.visual)) checkAsset(scene.assetId, scene.id);
    if (scene.visual === 'generated_illustration' && !scene.illustrationLabelEs?.trim()) issues.push(`Illustration label required: ${scene.id}`);
  }
  if (!bundle.audioAssetIds.length) issues.push('Licensed narration required');
  for (const id of bundle.audioAssetIds) checkAsset(id, id, 'audio');
  if (!validActor(a) || !a || a.renderSha256 !== bundle.renderSha256 || a.storyId !== source.story.id || a.scriptId !== script.id || a.scriptVersion !== script.version || a.articleId !== source.article.id || a.articleVersion !== source.article.version || a.dossierVersion !== source.dossierVersion) issues.push('Human approval for current video revisions required');
  return [...new Set(issues)];
}
