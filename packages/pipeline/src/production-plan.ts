import { quoteUnits, type ProductionCategory } from './production-budget';

export interface ProductionRateCard {
  version: string; expiresAt: string;
  /** Explicit microdollars per million units. No vendor prices are inferred. */
  rates: Record<'input_tokens' | 'output_tokens' | 'characters' | 'render_ms', number>;
}
export function productionPlan(input: { analysisInputTokens: number; analysisOutputTokens: number;
  contentInputTokens: number; contentOutputTokens: number; narrationEs: string; renderCeilingMs: number }, card?: ProductionRateCard) {
  for (const value of [input.analysisInputTokens,input.analysisOutputTokens,input.contentInputTokens,input.contentOutputTokens,input.renderCeilingMs]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Production ceilings must be non-negative integers');
  }
  if (card && (!card.version?.trim() || !Number.isFinite(Date.parse(card.expiresAt)) || Date.parse(card.expiresAt)<=Date.now())) throw new Error('Price card is missing a version or has expired');
  const steps: {category: ProductionCategory; units: Record<string, number>; estimateMicros: number | null}[] = [
    { category:'news_analysis',units:{input_tokens:input.analysisInputTokens,output_tokens:input.analysisOutputTokens},estimateMicros:null },
    { category:'content',units:{input_tokens:input.contentInputTokens,output_tokens:input.contentOutputTokens},estimateMicros:null },
    { category:'voice',units:{characters:Array.from(input.narrationEs).length},estimateMicros:null },
    { category:'video',units:{render_ms:input.renderCeilingMs},estimateMicros:null }
  ];
  if (card) for (const step of steps) step.estimateMicros = Object.entries(step.units).reduce((sum,[unit,n]) => sum + quoteUnits(n,card.rates[unit as keyof ProductionRateCard['rates']]),0);
  return { contract:'production-plan/1', priceVersion:card?.version ?? null, steps,
    totalMicros:card ? steps.reduce((sum,s)=>sum+s.estimateMicros!,0) : null,
    notes:['Token/runtime values are explicit planning ceilings, not measured usage.', 'Narration character count is Unicode code points; validate the chosen TTS billing unit before dispatch.', 'Both ES and EN text passes must be included in content ceilings.', 'No voice, video or scientific verification has been generated.'] };
}
export function metadataReview(story: { titleEn: string; identifiers: string[]; primarySourceRequired: boolean; flags: string[] }) {
  return { contract:'metadata-review/1', titleEn:story.titleEn, identifiers:story.identifiers,
    flags:[...new Set(story.flags)], nextSteps:story.primarySourceRequired ? ['Find the primary study','Review source evidence before drafting'] : ['Obtain permitted primary-source evidence','Review claims before drafting'],
    scientificStatus:'unverified', automaticSelection:false, paidCalls:0 };
}
