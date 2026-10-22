import { createWorkerStore } from '@science/storage';
import { runOnce } from './run-once';

const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const result = await runOnce(createWorkerStore(), controller.signal);
  console.log(JSON.stringify(result));
  if (result.event === 'job.failed' || result.event === 'job.lease_lost') process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ event: 'worker.failed' }));
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
