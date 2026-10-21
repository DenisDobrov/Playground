import { createWorkerStore } from '@science/storage';
import { canonicalSourceId } from '@science/sources';

const identifier = process.argv[2];
if (!identifier) throw new Error('Usage: worker:enqueue -- <DOI or arXiv ID>');
const canonicalId = canonicalSourceId(identifier);
const id = await createWorkerStore().enqueue('normalize_source', `normalize:${canonicalId}`, { identifier });
console.log(JSON.stringify({ event: 'job.enqueued', jobId: id, canonicalId }));
