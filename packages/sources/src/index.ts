/** Pure normalization only. Fetchers must use allowlists, rate limits and license metadata. */
export * from './feeds';
export * from './fetch';
export * from './reviews';
export * from './review-submission';
export * from './metadata';
export function canonicalSourceId(input: string): string {
  const value = input.trim();
  const doi = value.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  if (/^10\.\d{4,9}\/\S+$/i.test(doi)) return `doi:${doi.toLowerCase()}`;
  const arxiv = value.replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//i, '').replace(/^arxiv:\s*/i, '').replace(/\.pdf$/i, '');
  if (/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i.test(arxiv)) return `arxiv:${arxiv.replace(/v\d+$/i, '').toLowerCase()}`;
  throw new Error('Provide a DOI or arXiv identifier; arbitrary URL fetching is not enabled');
}
