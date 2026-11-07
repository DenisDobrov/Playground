import { createHash } from 'node:crypto';

export const productionCategories = ['news_analysis', 'content', 'voice', 'video'] as const;
export type ProductionCategory = typeof productionCategories[number];
export type Usage = Partial<Record<'input_tokens' | 'output_tokens' | 'characters' | 'render_ms' | 'audio_ms' | 'cached_input_tokens' | 'thinking_tokens', number>>;
export interface ProductionQuote {
  key: string; month: string; category: ProductionCategory; estimateMicros: number;
  storyId: string | null; videoKey: string | null; tool: string; toolVersion: string; priceVersion: string; inputHash: string;
}
export interface BudgetOperation { id: string; state: 'reserved' | 'started' | 'uncertain' | 'settled' | 'released' }
export interface BudgetStore {
  reserve(quote: ProductionQuote): Promise<BudgetOperation>;
  start(id: string): Promise<string>;
  settle(id: string, token: string, actualMicros: number, usage: Usage, reference: string): Promise<void>;
  uncertain(id: string, token: string): Promise<void>;
  release(id: string): Promise<void>;
}
export function microdollars(value: string): number {
  if (!/^\d{1,7}(\.\d{1,6})?$/.test(value)) throw new Error('Use a non-negative USD amount with at most six decimals');
  const [whole, fraction = ''] = value.split('.');
  const result = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'));
  if (!Number.isSafeInteger(result) || result > 1_000_000_000_000) throw new Error('Amount exceeds ledger range');
  return result;
}
/** Rate is microdollars per million units. Round each component up, never down. */
export function quoteUnits(units: number, rateMicrosPerMillion: number): number {
  if (![units, rateMicrosPerMillion].every(v => Number.isSafeInteger(v) && v >= 0)) throw new Error('Invalid metering values');
  const result = (BigInt(units) * BigInt(rateMicrosPerMillion) + 999999n) / 1000000n;
  if (result > 1000000000000n) throw new Error('Estimate exceeds ledger range');
  return Number(result);
}
export const currentBudgetMonth = () => new Date().toISOString().slice(0, 7) + '-01';
export const productionInputHash = (input: string) => createHash('sha256').update(input).digest('hex');

/** The caller supplies a metered adapter; never automatically replay a dispatched call. */
export async function executeBudgeted<T>(store: BudgetStore, quote: ProductionQuote,
  invoke: (context: { operationId: string }) => Promise<{ output: T; actualMicros: number; usage: Usage; reference: string }>) {
  if (quote.month !== currentBudgetMonth()) throw new Error('Dispatch requires the current UTC budget month');
  const operation = await store.reserve(quote);
  if (operation.state !== 'reserved') return { status: 'held' as const, operationId: operation.id, reason: 'Already dispatched or resolved; inspect the persisted result before any new attempt' };
  // A second worker cannot obtain a second token for the same reservation.
  const token = await store.start(operation.id);
  try {
    const result = await invoke({ operationId: operation.id });
    await store.settle(operation.id, token, result.actualMicros, result.usage, result.reference);
    return { status: 'settled' as const, operationId: operation.id, output: result.output };
  } catch {
    // Includes an ambiguous settlement response. Never release possibly billed work.
    await store.uncertain(operation.id, token).catch(() => {});
    throw new Error('Production operation needs reconciliation; automatic paid retry is blocked');
  }
}
