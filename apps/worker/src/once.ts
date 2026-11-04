import { createWorkerStore } from '@science/storage';
import { runOnce } from './run-once';

const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const mode = process.env.WORKER_QUEUE_MODE;
  if (mode && !['all', 'acceptance'].includes(mode)) throw new Error('Invalid worker queue mode');
  const store = createWorkerStore(mode === 'acceptance');
  if (mode === 'acceptance') {
    const claim = store.claim;
    store.claim = async () => {
      const job = await claim();
      if (job) {
        console.log(JSON.stringify({ event: 'job.claimed', jobId: job.id, attempts: job.attempts, at: new Date().toISOString() }));
        // Exercise the existing lease RPC even for a sub-second normalization job.
        await store.renew(job);
        console.log(JSON.stringify({ event: 'job.lease_renewed', jobId: job.id, at: new Date().toISOString() }));
      }
      return job;
    };
  }
  const result = await runOnce(store, controller.signal);
  console.log(JSON.stringify(result));
  if (result.event === 'job.failed' || result.event === 'job.lease_lost') process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ event: 'worker.failed' }));
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
