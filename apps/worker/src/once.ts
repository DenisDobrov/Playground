import { createWorkerStore } from '@science/storage';
import { canonicalSourceId } from '@science/sources';

const store = createWorkerStore();
const job = await store.claim();
if (!job) {
  console.log(JSON.stringify({ event: 'worker.idle' }));
} else {
  try {
    // Foundation supports only source normalization. No accidental paid model calls.
    if (job.stage !== 'normalize_source') {
      await store.fail(job, 'STAGE_NOT_IMPLEMENTED', true);
      console.log(JSON.stringify({ event: 'job.held', jobId: job.id, stage: job.stage }));
    } else {
      if (typeof job.payload.identifier !== 'string') throw new Error('INVALID_IDENTIFIER');
      const canonicalId = canonicalSourceId(job.payload.identifier);
      await store.finish(job, { canonicalId });
      console.log(JSON.stringify({ event: 'job.succeeded', jobId: job.id }));
    }
  } catch {
    await store.fail(job, 'JOB_FAILED');
    console.error(JSON.stringify({ event: 'job.failed', jobId: job.id }));
    process.exitCode = 1;
  }
}
