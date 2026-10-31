import { dossierSchema, publicationIssues, stageNames, type ReleaseBundle, type Stage } from '@science/core';
import type { ModelAdapter } from '@science/llm';

export const researchPrompt = {
  version: 'researcher/0.1.0',
  instructions: 'Produce an English scientific research dossier from provided sources only. Every atomic claim needs a short exact quotation and a locator. Distinguish measured results, author interpretations, vendor claims, editorial explanations and speculation. Do not invent independent verification. All new claims must have status unverified. List limitations and what authors do not claim.'
};

export async function research(adapter: ModelAdapter, sourceMaterial: unknown) {
  return adapter.run({ role: 'researcher', promptVersion: researchPrompt.version, instructions: researchPrompt.instructions, untrustedInput: sourceMaterial, schema: dossierSchema });
}
export interface StageEvent { stage: Stage; status: 'completed' | 'blocked' | 'not_implemented'; reason: string }

/** Honest offline rehearsal: fixtures never become independently verified or publishable. */
export function rehearse(bundle: ReleaseBundle): { events: StageEvent[]; releaseIssues: string[] } {
  dossierSchema.parse(bundle.dossier);
  const events: StageEvent[] = stageNames.map(stage => {
    if (['discovery', 'ranking', 'research', 'writing', 'visual_plan'].includes(stage)) {
      return { stage, status: 'completed', reason: 'Loaded synthetic fixture; no model call or real scientific validation.' };
    }
    if (stage === 'voice' || stage === 'render') return { stage, status: 'not_implemented', reason: 'Production voice and video assets have not been supplied.' };
    return { stage, status: 'blocked', reason: 'Needs independent verification, language review and version-bound human approval.' };
  });
  return { events, releaseIssues: publicationIssues(bundle) };
}

export function assertBudget(usedUsd: number, reservedUsd: number, estimatedUsd: number, limitUsd: number): void {
  if ([usedUsd, reservedUsd, estimatedUsd, limitUsd].some(v => !Number.isFinite(v) || v < 0)) throw new Error('Invalid budget values');
  if (usedUsd + reservedUsd + estimatedUsd > limitUsd) throw new Error('Budget exceeded: hold job for editor');
}
export * from './production-budget';
export * from './production-plan';
export * from './content-generation';
