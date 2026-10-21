import { describe, expect, it, vi } from 'vitest';
import { runOnce } from '../apps/worker/src/run-once';

function store(stage = 'normalize_source', identifier = '2401.12345') {
  return {
    enqueue: vi.fn(), claim: vi.fn().mockResolvedValue({ id: 'job', stage, payload: { identifier }, lease_token: 'lease', attempts: 1, story_id: null }),
    finish: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined), renew: vi.fn().mockResolvedValue(undefined)
  };
}
describe('one-shot worker lifecycle', () => {
  it('does not claim a job after graceful shutdown has begun', async () => {
    const db = store(); const abort = new AbortController(); abort.abort();
    expect((await runOnce(db, abort.signal)).event).toBe('worker.stopped');
    expect(db.claim).not.toHaveBeenCalled();
  });
  it('holds unsupported stages instead of treating them as complete', async () => {
    const db = store('research');
    expect((await runOnce(db, new AbortController().signal)).event).toBe('job.held');
    expect(db.finish).not.toHaveBeenCalled();
    expect(db.fail.mock.calls[0][2]).toBe(true);
  });
  it('failed input is retryable and never acknowledged as successful', async () => {
    const db = store('normalize_source','http://localhost/private');
    expect((await runOnce(db, new AbortController().signal)).event).toBe('job.failed');
    expect(db.finish).not.toHaveBeenCalled();
  });
});
