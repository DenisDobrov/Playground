import { createClient } from '@supabase/supabase-js';

export interface ProductionJob {
  id: string; story_id: string | null; stage: string; payload: Record<string, unknown>;
  attempts: number; lease_token: string;
}
export function createWorkerStore() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async claim(): Promise<ProductionJob | null> {
      const { data, error } = await db.rpc('claim_job');
      if (error) throw new Error(`Job claim failed: ${error.code}`);
      return (data?.[0] as ProductionJob | undefined) ?? null;
    },
    async finish(job: ProductionJob, result: unknown) {
      const { data, error } = await db.rpc('finish_job', { p_id: job.id, p_lease: job.lease_token, p_result: result });
      if (error || data !== true) throw new Error('Job completion failed or lease lost');
    },
    async fail(job: ProductionJob, errorCode: string, hold = false) {
      const { data, error } = await db.rpc('fail_job', { p_id: job.id, p_lease: job.lease_token, p_error: errorCode, p_hold: hold });
      if (error || data !== true) throw new Error('Job failure update failed or lease lost');
    }
  };
}
