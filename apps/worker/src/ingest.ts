import { createClient } from '@supabase/supabase-js';
import { feedRegistry, fetchFeed, parseFeed, freshness, feedFreshness, type FeedId } from '@science/sources';
const feedId = process.argv[2] as FeedId;
if (!Object.hasOwn(feedRegistry, feedId)) throw new Error('Choose arxiv-ai, arxiv-physics or nasa-news');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Worker credentials required');
if (process.env.SUPABASE_DB_SCHEMA && process.env.SUPABASE_DB_SCHEMA !== 'academy') throw new Error('Academy schema required');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'academy' }, auth: { persistSession: false, autoRefreshToken: false } });
const claim = await db.rpc('claim_feed', { p_feed: feedId });
if (claim.error) throw new Error(`Feed claim failed: ${claim.error.code}`);
if (!claim.data) { console.log(JSON.stringify({ event: 'feed.deferred', feedId })); process.exit(0); }
const lease = claim.data;
let acknowledged = false;
try {
  const response = await fetchFeed(feedId, { etag: lease.etag, lastModified: lease.last_modified });
  let latest = lease.latest_entry_at as string | null; let count = 0;
  if (response.status === 200) {
    const candidates = parseFeed(feedId, response.text, new Date().toISOString());
    latest = candidates.flatMap(c => [c.revisionAt, c.originalPublishedAt, c.pressReleaseAt]).filter((s): s is string => Boolean(s)).sort().at(-1) || null;
    for (const candidate of candidates) {
      const { error } = await db.rpc('ingest_candidate', { p_token: lease.token, p_entry: { ...candidate, flags: freshness(candidate) } });
      if (error) throw new Error(`Source intake failed: ${error.code}`);
      count++;
    }
  }
  const backoff = [429, 503].includes(response.status);
  const { data, error } = await db.rpc('finish_feed', { p_feed: feedId, p_token: lease.token, p_status: response.status, p_etag: response.etag, p_last_modified: response.lastModified, p_latest_entry: latest, p_error: backoff ? `HTTP_${response.status}` : null, p_delay: backoff ? response.retryAfterSeconds : 3 });
  if (error || data !== true) throw new Error('Feed lease lost');
  acknowledged = true;
  console.log(JSON.stringify({ event: backoff ? 'feed.backoff' : response.status === 304 ? 'feed.not_modified' : 'feed.ingested', feedId, count, freshness: feedFreshness(latest, new Date().toISOString()), paidCalls: 0 }));
} catch {
  if (!acknowledged) await db.rpc('finish_feed', { p_feed: feedId, p_token: lease.token, p_status: 0, p_etag: null, p_last_modified: null, p_latest_entry: null, p_error: 'INGESTION_FAILED', p_delay: 60 });
  console.error(JSON.stringify({ event: 'feed.failed', feedId, reason: 'Check endpoint availability, XML, identity conflicts or lease; no cursor advanced.' }));
  process.exitCode = 1;
}
