import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { canonicalSourceId } from './index';
export const feedRegistry = {
  'arxiv-ai': { provider: 'arxiv', domain: 'ai', url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=21' },
  'arxiv-physics': { provider: 'arxiv', domain: 'physics', url: 'https://export.arxiv.org/api/query?search_query=cat:hep-ex+OR+cat:gr-qc+OR+cat:astro-ph.CO+OR+cat:quant-ph&sortBy=submittedDate&sortOrder=descending&max_results=9' },
  'nasa-news': { provider: 'nasa', domain: 'physics', url: 'https://www.nasa.gov/news-release/feed/' }
} as const;
export type FeedId = keyof typeof feedRegistry;
export interface FeedCandidate {
  canonicalId: string; aliases: string[]; url: string; titleEn: string; domain: 'ai' | 'physics';
  kind: 'preprint' | 'institution'; originalPublishedAt: string | null; revisionAt: string | null;
  pressReleaseAt: string | null; fetchedAt: string; feedId: FeedId; categories: string[];
}
const list = <T>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
const text = (v: unknown): string => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
function date(v: unknown): string | null {
  const s = text(v); return s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null;
}
export function freshness(c: Pick<FeedCandidate, 'originalPublishedAt' | 'revisionAt' | 'pressReleaseAt' | 'fetchedAt'>, rehashDays = 180): string[] {
  const flags: string[] = [];
  if (!Number.isFinite(Date.parse(c.fetchedAt)) || !Number.isFinite(rehashDays) || rehashDays < 1) throw new Error('Invalid freshness policy');
  const at = Date.parse(c.fetchedAt);
  for (const d of [c.originalPublishedAt, c.revisionAt, c.pressReleaseAt]) {
    if (d && (!Number.isFinite(Date.parse(d)) || Date.parse(d) > at + 86400000)) flags.push('invalid_or_future_date');
  }
  if (!c.originalPublishedAt) flags.push('original_date_unknown');
  else {
    const original = Date.parse(c.originalPublishedAt);
    const reference = Date.parse(c.pressReleaseAt || c.fetchedAt);
    if (reference - original > rehashDays * 86400000) flags.push(c.pressReleaseAt ? 'rehash' : 'older_original');
    if (c.revisionAt && Date.parse(c.revisionAt) < original) flags.push('revision_before_original');
  }
  return flags;
}
export function feedFreshness(latestEntryAt: string | null, checkedAt: string, maxAgeDays = 30): 'current' | 'stale' | 'unknown' | 'future' {
  if (!latestEntryAt) return 'unknown';
  const age = Date.parse(checkedAt) - Date.parse(latestEntryAt);
  if (!Number.isFinite(age)) return 'unknown';
  return age < -86400000 ? 'future' : age > maxAgeDays * 86400000 ? 'stale' : 'current';
}
export function parseFeed(feedId: FeedId, xml: string, fetchedAt: string): FeedCandidate[] {
  const config = feedRegistry[feedId];
  if (!Object.hasOwn(feedRegistry,feedId) || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('Unknown feed or invalid fetch date');
  if (Buffer.byteLength(xml) > 2_000_000 || /<!\s*(DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Unsafe or invalid feed XML');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: false }).parse(xml);
  const result: FeedCandidate[] = [];
  if (config.provider === 'arxiv') {
    if (!parsed.feed) throw new Error('Expected Atom feed');
    for (const entry of list<Record<string, any>>(parsed.feed.entry).slice(0, 50)) {
      const raw = text(entry.id);
      if (!/^https?:\/\/arxiv\.org\/abs\//.test(raw)) throw new Error('Unexpected arXiv identity');
      const canonicalId = canonicalSourceId(raw);
      const categories = list<Record<string, string>>(entry.category).map(c => c['@_term']);
      const allowed = config.domain === 'ai' ? ['cs.AI','cs.CL','cs.LG'] : ['hep-ex','gr-qc','astro-ph.CO','quant-ph'];
      if (!categories.some(c => allowed.includes(c))) continue;
      const aliases = [canonicalId];
      const doi = text(entry['arxiv:doi']);
      if (doi) aliases.push(canonicalSourceId(doi));
      result.push({ canonicalId, aliases, url: `https://arxiv.org/abs/${canonicalId.slice(6)}`, titleEn: text(entry.title).slice(0, 500), domain: config.domain, kind: 'preprint', originalPublishedAt: date(entry.published), revisionAt: date(entry.updated), pressReleaseAt: null, fetchedAt, feedId, categories });
    }
  } else {
    if (!parsed.rss?.channel) throw new Error('Expected NASA RSS');
    for (const entry of list<Record<string, any>>(parsed.rss.channel.item).slice(0, 20)) {
      const url = new URL(text(entry.link));
      if (url.protocol !== 'https:' || url.hostname !== 'www.nasa.gov' || url.port || url.username || url.password || !url.pathname.startsWith('/news-release/')) continue;
      url.hash = ''; url.search = '';
      const canonicalId = `nasa:${url.pathname}`;
      result.push({ canonicalId, aliases: [canonicalId], url: url.href, titleEn: text(entry.title).slice(0, 500), domain: 'physics', kind: 'institution', originalPublishedAt: null, revisionAt: null, pressReleaseAt: date(entry.pubDate), fetchedAt, feedId, categories: [] });
    }
  }
  if (result.some(c => c.titleEn.length < 3)) throw new Error('Feed entry needs a title');
  return result;
}
