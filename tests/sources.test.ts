import { describe, expect, it } from 'vitest';
import { parseFeed, freshness, feedFreshness, retryDelay, isPublicAddress } from '@science/sources';
const now = '2026-10-22T10:00:00Z';
const atom = (published = '2026-10-21T10:00:00Z', updated = published) => `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"><entry><id>http://arxiv.org/abs/2610.12345v2</id><title>New synthetic AI result</title><published>${published}</published><updated>${updated}</updated><category term="cs.AI"/><arxiv:doi>10.9999/Example</arxiv:doi></entry></feed>`;
describe('bounded source ingestion', () => {
  it('normalizes arXiv revisions, preserves original dates and links DOI alias', () => {
    const [entry] = parseFeed('arxiv-ai', atom('2024-01-01T00:00:00Z','2026-10-21T10:00:00Z'), now);
    expect(entry.canonicalId).toBe('arxiv:2610.12345'); expect(entry.aliases).toContain('doi:10.9999/example');
    expect(entry.originalPublishedAt).toBe('2024-01-01T00:00:00.000Z'); expect(freshness(entry)).toContain('older_original');
  });
  it('does not treat NASA release date as scientific publication date', () => {
    const [entry] = parseFeed('nasa-news', '<rss><channel><item><title>Synthetic release</title><link>https://www.nasa.gov/news-release/synthetic/</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>',now);
    expect(entry.originalPublishedAt).toBeNull(); expect(entry.pressReleaseAt).not.toBeNull(); expect(freshness(entry)).toContain('original_date_unknown');
  });
  it('does not admit arbitrary item hosts or categories', () => {
    expect(parseFeed('arxiv-physics', atom(),now)).toEqual([]);
    expect(parseFeed('nasa-news','<rss><channel><item><title>Bad target</title><link>http://127.0.0.1/private</link></item></channel></rss>',now)).toEqual([]);
  });
  it('rejects DTD, entity declarations, malformed XML and wrong roots', () => {
    for (const xml of ['<!DOCTYPE x [<!ENTITY test SYSTEM "file:///secret">]><feed/>','<feed>','<html/>']) expect(() => parseFeed('arxiv-ai',xml,now)).toThrow();
  });
  it('flags rehash, inconsistent and future dates', () => {
    const entry = parseFeed('arxiv-ai',atom('2024-01-01T00:00:00Z'),now)[0];
    expect(freshness({...entry,pressReleaseAt:now})).toContain('rehash');
    expect(freshness({...entry,revisionAt:'2023-01-01T00:00:00Z'})).toContain('revision_before_original');
    expect(freshness({...entry,originalPublishedAt:'2030-01-01T00:00:00Z'})).toContain('invalid_or_future_date');
  });
  it('detects stale feeds from latest item dates, not last HTTP contact', () => {
    expect(feedFreshness('2024-01-01T00:00:00Z',now)).toBe('stale'); expect(feedFreshness(null,now)).toBe('unknown'); expect(feedFreshness(now,now)).toBe('current');
  });
  it('rejects private, reserved and mapped DNS targets', () => {
    for (const ip of ['127.0.0.1','10.0.0.1','172.16.1.2','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','::1','::ffff:127.0.0.1']) expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('192.0.66.108')).toBe(true); // NASA's public WordPress host is not 192.0.0.0/24.
    expect(isPublicAddress('192.0.2.1')).toBe(false); expect(isPublicAddress('203.0.113.1')).toBe(false);
  });
  it('honors Retry-After with bounded cooldown', () => {
    expect(retryDelay('120')).toBe(120); expect(retryDelay('nonsense')).toBe(60); expect(retryDelay('0')).toBe(3);
  });
});
