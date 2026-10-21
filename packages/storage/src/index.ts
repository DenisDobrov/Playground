import { createClient } from '@supabase/supabase-js';

export interface ProductionJob {
  id: string; story_id: string | null; stage: string; payload: Record<string, unknown>;
  attempts: number; lease_token: string;
}
export function createWorkerStore() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const schema = process.env.SUPABASE_DB_SCHEMA ?? 'academy';
  if (schema !== 'academy') throw new Error('Worker is restricted to the academy schema');
  const db = createClient(url, secret, { db: { schema }, auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async enqueue(stage: string, idempotencyKey: string, payload: Record<string, unknown>, storyId: string | null = null): Promise<string> {
      const { data, error } = await db.rpc('enqueue_job', { p_stage: stage, p_key: idempotencyKey, p_payload: payload, p_story: storyId });
      if (error || !data) throw new Error(`Job enqueue failed: ${error?.code ?? 'EMPTY_RESULT'}`);
      return data as string;
    },
    async claim(): Promise<ProductionJob | null> {
      const { data, error } = await db.rpc('claim_job');
      if (error) throw new Error(`Job claim failed: ${error.code}`);
      return (data?.[0] as ProductionJob | undefined) ?? null;
    },
    async finish(job: ProductionJob, result: unknown) {
      const { data, error } = await db.rpc('finish_job', { p_id: job.id, p_lease: job.lease_token, p_result: result });
      if (error || data !== true) throw new Error('Job completion failed or lease lost');
    },
    async renew(job: ProductionJob) {
      const { data, error } = await db.rpc('renew_job', { p_id: job.id, p_lease: job.lease_token });
      if (error || data !== true) throw new Error('Job renewal failed or lease lost');
    },
    async fail(job: ProductionJob, errorCode: string, hold = false) {
      const { data, error } = await db.rpc('fail_job', { p_id: job.id, p_lease: job.lease_token, p_error: errorCode, p_hold: hold });
      if (error || data !== true) throw new Error('Job failure update failed or lease lost');
    }
  };
}
