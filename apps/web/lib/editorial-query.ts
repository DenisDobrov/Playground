export type EditorialParams = Record<string, string | string[] | undefined>;
export const catalogStatuses = ['candidate', 'researching', 'review', 'held', 'published'] as const;
export const catalogDecisions = ['select', 'reject', 'hold', 'revise'] as const;
export function editorialQuery(params: EditorialParams) {
  const single = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  const allowed = (key: string, values: readonly string[]) => values.includes(single(key)) ? single(key) : '';
  const page = Number(single('page') || 1);
  return { q: single('q').trim().slice(0, 200), domain: allowed('domain', ['ai', 'physics']),
    status: allowed('status', catalogStatuses), decision: allowed('decision', catalogDecisions),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1 };
}
export function catalogUrl(query: ReturnType<typeof editorialQuery>, page = query.page) {
  const params = new URLSearchParams();
  for (const key of ['q', 'domain', 'status', 'decision'] as const) if (query[key]) params.set(key, query[key]);
  if (page > 1) params.set('page', String(page));
  return '/editorial/stories' + (params.size ? '?' + params.toString() : '');
}
/** Escape SQL LIKE metacharacters; PostgREST also accepts * as its wildcard alias. */
export const literalSearch = (text: string) => '%' + text.replace(/[\\%_]/g, '\\$&') + '%';
export function decisionReturnPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/editorial/stories')) return '/editorial';
  const url = new URL(value, 'https://academy.invalid');
  if (url.origin !== 'https://academy.invalid' || url.pathname !== '/editorial/stories') return '/editorial';
  return catalogUrl(editorialQuery(Object.fromEntries(url.searchParams)));
}
