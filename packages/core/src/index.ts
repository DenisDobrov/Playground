import { z } from 'zod';
export * from './releases';
export * from './localized-article';
export * from './research';
export * from './dossier-video';
export * from './content';

export const claimTypes = ['measured_result', 'author_interpretation', 'theoretical_prediction', 'vendor_claim', 'editorial_explanation', 'speculation'] as const;
export const stageNames = ['discovery', 'ranking', 'research', 'verification', 'writing', 'language_check', 'visual_plan', 'voice', 'render', 'editorial_review', 'publication'] as const;
export type Stage = typeof stageNames[number];
export type DomainId = string;
export interface DomainPack {
  id: DomainId;
  version: string;
  labelEs: string;
  weeklyShare: number;
  risk: 'standard' | 'high';
  autonomy: 'shadow' | 'full_audit' | 'sampling';
  evidenceLevels: readonly string[];
  sources: readonly string[];
  glossary: Record<string, string>;
}

export const domainPacks: Record<string, DomainPack> = {
  ai: { id: 'ai', version: '0.1.0', labelEs: 'Inteligencia artificial', weeklyShare: 0.7, risk: 'standard', autonomy: 'shadow', evidenceLevels: ['A0', 'A1', 'A2', 'A3', 'A-'], sources: ['arxiv:cs.AI', 'arxiv:cs.CL', 'arxiv:cs.LG'], glossary: { 'fine-tuning': 'ajuste fino' } },
  physics: { id: 'physics', version: '0.1.0', labelEs: 'Física y espacio', weeklyShare: 0.3, risk: 'standard', autonomy: 'shadow', evidenceLevels: ['P0', 'P1', 'P2', 'P3', 'P-'], sources: ['arxiv:hep-ex', 'arxiv:gr-qc', 'arxiv:astro-ph', 'arxiv:quant-ph'], glossary: { 'gravitational lensing': 'lente gravitacional' } }
};

export const evidenceSchema = z.object({
  id: z.string().min(1), sourceId: z.string().min(1),
  quote: z.string().min(1).max(1500), locator: z.string().min(1),
  sourceUrl: z.url(), accessedAt: z.iso.datetime()
});
export const claimSchema = z.object({
  id: z.string().min(1), textEn: z.string().min(1), type: z.enum(claimTypes),
  domainId: z.string().min(1), evidenceLevel: z.string().min(1),
  status: z.enum(['unverified', 'verified', 'narrowed', 'rejected']),
  evidenceIds: z.array(z.string()).min(1), caveatEn: z.string()
});
export const dossierSchema = z.object({
  storyId: z.string().min(1), summaryEn: z.string().min(1),
  methodologyEn: z.array(z.string()).min(1), limitationsEn: z.array(z.string()).min(1),
  authorsDoNotClaimEn: z.array(z.string()).min(1), openQuestionsEn: z.array(z.string()),
  claims: z.array(claimSchema).min(1), evidence: z.array(evidenceSchema).min(1)
});
export type Claim = z.infer<typeof claimSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type ResearchDossier = z.infer<typeof dossierSchema>;

export interface ScientificStory {
  id: string; slug: string; titleEn: string; titleEs: string;
  domainIds: string[]; score: number; scoreReasonEn: string;
  status: 'candidate' | 'researching' | 'review' | 'published' | 'held';
  sourceIds: string[]; conceptQids: string[];
}
export interface Source {
  id: string; canonicalId: string; url: string; titleEn: string;
  kind: 'paper' | 'preprint' | 'institution' | 'vendor' | 'discovery';
  peerReviewed: boolean; fullTextAvailable: boolean; license: string | null;
}
export interface Article {
  id: string; storyId: string; version: number; language: 'es'; title: string;
  paragraphs: { textEs: string; claimIds: string[] }[];
  aiDisclosureEs: string;
}
export interface Scene {
  id: string; narrationEs: string; durationSeconds: number; claimIds: string[];
  visual: 'real_asset' | 'paper_figure' | 'diagram' | 'generated_illustration' | 'chart' | 'text';
  visualDescription: string; assetId?: string; illustrationLabelEs?: string;
}
export interface Script { id: string; storyId: string; version: number; language: 'es'; scenes: Scene[] }
export interface ContentAsset {
  id: string; kind: 'image' | 'audio' | 'video'; path: string;
  sourceUrl: string | null; license: string | null; attribution: string;
  rightsCleared: boolean; generated: boolean;
}
export interface EditorialApproval {
  actorId: string; approvedAt: string; storyId: string;
  articleVersion: number; scriptVersion: number;
}
export interface ReleaseBundle {
  story: ScientificStory; dossier: ResearchDossier; article: Article; script: Script;
  assets: ContentAsset[]; approval?: EditorialApproval;
  languageCheckPassed: boolean; independentVerificationPassed: boolean;
}

/** @deprecated Legacy combined demo gate. Publishers must use separate article/video gates. */
export function publicationIssues(bundle: ReleaseBundle, packs = domainPacks): string[] {
  const issues: string[] = [];
  const { story, dossier, article, script, approval } = bundle;
  const claims = new Map(dossier.claims.map(c => [c.id, c]));
  const evidence = new Map(dossier.evidence.map(e => [e.id, e]));
  if (dossier.storyId !== story.id || article.storyId !== story.id || script.storyId !== story.id) issues.push('Story identity mismatch');
  if (!story.domainIds.length || story.domainIds.some(d => !packs[d])) issues.push('Unknown or missing domain');
  if (!bundle.independentVerificationPassed) issues.push('Independent verification required');
  if (!bundle.languageCheckPassed) issues.push('Spanish claim alignment check required');
  if (!article.aiDisclosureEs.trim()) issues.push('AI disclosure required');
  if (!article.paragraphs.length || !script.scenes.length) issues.push('Article and video script required');
  for (const claim of dossier.claims) {
    const pack = packs[claim.domainId];
    if (!pack || !story.domainIds.includes(claim.domainId) || !pack.evidenceLevels.includes(claim.evidenceLevel)) issues.push(`Invalid evidence scale: ${claim.id}`);
    for (const id of claim.evidenceIds) {
      const ev = evidence.get(id);
      if (!ev || !ev.quote.trim() || !ev.locator.trim() || !story.sourceIds.includes(ev.sourceId)) issues.push(`Missing provenance: ${claim.id}`);
    }
  }
  const references = [...article.paragraphs.map(p => p.claimIds), ...script.scenes.map(s => s.claimIds)];
  for (const ids of references) {
    if (!ids.length) issues.push('Unmapped article paragraph or video scene');
    for (const id of ids) {
      const claim = claims.get(id);
      if (!claim || !['verified', 'narrowed'].includes(claim.status) || !claim.evidenceIds.length) issues.push(`Unsupported published claim: ${id}`);
    }
  }
  for (const scene of script.scenes) {
    if (!Number.isFinite(scene.durationSeconds) || scene.durationSeconds <= 0) issues.push(`Invalid duration: ${scene.id}`);
    if (['real_asset', 'paper_figure'].includes(scene.visual)) {
      const asset = bundle.assets.find(a => a.id === scene.assetId);
      if (!asset || !asset.rightsCleared || !asset.license || !asset.attribution.trim()) issues.push(`Uncleared visual rights: ${scene.id}`);
    }
    if (scene.visual === 'generated_illustration' && !scene.illustrationLabelEs?.trim()) issues.push(`Illustration label required: ${scene.id}`);
  }
  // Initial MVP always requires a human; changing autonomy needs a separate ADR and eval.
  if (!approval || approval.storyId !== story.id || !approval.actorId.trim() || !Number.isFinite(Date.parse(approval.approvedAt)) || approval.articleVersion !== article.version || approval.scriptVersion !== script.version) issues.push('Human approval for current versions required');
  return [...new Set(issues)];
}
export { selectionFeedback } from './selection-gold';
