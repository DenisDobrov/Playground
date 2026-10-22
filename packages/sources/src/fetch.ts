import { request } from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { feedRegistry, type FeedId } from './feeds';

export function isPublicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)) || (b === 88 && c === 99))) || (a === 198 && ([18, 19].includes(b) || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Fixed registry currently uses IPv4. Reject IPv6 and mapped forms rather than risk private ranges.
  return false;
}
export interface FeedResponse { status: number; text: string; etag: string | null; lastModified: string | null; retryAfterSeconds: number }
export function retryDelay(header: string | undefined, now = Date.now()): number {
  const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? (Date.parse(header) - now) / 1000 : 60;
  return Math.max(3, Math.min(86400, Number.isFinite(seconds) ? Math.ceil(seconds) : 60));
}
/** Fixed HTTPS endpoints, validated DNS used by the actual connection, no redirects or item fetches. */
export async function fetchFeed(id: FeedId, conditional: { etag?: string | null; lastModified?: string | null } = {}): Promise<FeedResponse> {
  const feed = feedRegistry[id];
  if (!Object.hasOwn(feedRegistry,id)) throw new Error('Unknown feed');
  const headers: Record<string, string> = { 'User-Agent': 'DobrovAcademy/0.1 (+https://dobrov.org)', Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml', 'Accept-Encoding': 'identity' };
  if (conditional.etag) headers['If-None-Match'] = conditional.etag;
  if (conditional.lastModified) headers['If-Modified-Since'] = conditional.lastModified;
  return new Promise((resolve, reject) => {
    const req = request(feed.url, { headers, signal: AbortSignal.timeout(20000), lookup(host, options, callback) {
      dnsLookup(host, { all: true, family: 4 }, (error, addresses) => {
        if (error || !addresses.length || addresses.some(a => !isPublicAddress(a.address))) return callback(new Error('Feed DNS address rejected'), '', 4);
        if (typeof options === 'object' && options.all) (callback as Function)(null, addresses);
        else callback(null, addresses[0].address, 4);
      });
    } }, res => {
      const status = res.statusCode || 0;
      const result: FeedResponse = { status, text: '', etag: res.headers.etag || null, lastModified: res.headers['last-modified'] || null, retryAfterSeconds: retryDelay(res.headers['retry-after']) };
      if (![200, 304, 429, 503].includes(status)) { res.destroy(); reject(new Error(`Feed HTTP ${status}; redirects are not followed`)); return; }
      if (status !== 200) { res.destroy(); resolve(result); return; }
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { res.destroy(); reject(new Error('Unexpected content encoding')); return; }
      if (!/(xml|rss|atom)/i.test(res.headers['content-type'] || '')) { res.destroy(); reject(new Error('Expected XML response')); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 2_000_000) res.destroy(new Error('Feed response too large')); else chunks.push(chunk); });
      res.on('end', () => resolve({ ...result, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
}
