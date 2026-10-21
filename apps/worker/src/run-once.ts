import type { createWorkerStore } from '@science/storage';
import { canonicalSourceId } from '@science/sources';

type Store = ReturnType<typeof createWorkerStore>;
export async function runOnce(store: Store, signal: AbortSignal) {
  if (signal.aborted) return { event: 'worker.stopped' };
  const job = await store.claim();
  if (!job) return { event: 'worker.idle' };
  let heartbeatError = false;
  let renewal: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (!renewal) renewal = store.renew(job).catch(() => { heartbeatError = true; }).finally(() => { renewal = undefined; });
  }, 30_000);
  timer.unref();
  const stopHeartbeat = async () => { clearInterval(timer); await renewal; };
  try {
    if (signal.aborted) throw new Error('WORKER_INTERRUPTED');
    if (job.stage !== 'normalize_source') {
      await stopHeartbeat();
      await store.fail(job, 'STAGE_NOT_IMPLEMENTED', true);
      return { event: 'job.held', jobId: job.id, stage: job.stage };
    }
    if (typeof job.payload.identifier !== 'string') throw new Error('INVALID_IDENTIFIER');
    const canonicalId = canonicalSourceId(job.payload.identifier);
    await stopHeartbeat();
    if (heartbeatError) throw new Error('LEASE_LOST');
    if (signal.aborted) throw new Error('WORKER_INTERRUPTED');
    await store.finish(job, { canonicalId });
    return { event: 'job.succeeded', jobId: job.id };
  } catch {
    await stopHeartbeat();
    if (!heartbeatError) await store.fail(job, signal.aborted ? 'WORKER_INTERRUPTED' : 'JOB_FAILED').catch(() => {});
    return { event: heartbeatError ? 'job.lease_lost' : 'job.failed', jobId: job.id };
  } finally {
    await stopHeartbeat();
  }
}
