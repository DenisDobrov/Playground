import { createClient } from '@supabase/supabase-js';
import type { BudgetStore, ProductionQuote, Usage,ContentRepository } from '@science/pipeline';

export interface ProductionJob {
  id: string; story_id: string | null; stage: string; payload: Record<string, unknown>;
  attempts: number; lease_token: string;
}
function workerClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error('Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const schema = process.env.SUPABASE_DB_SCHEMA ?? 'academy';
  if (schema !== 'academy') throw new Error('Worker is restricted to the academy schema');
  return createClient(url, secret, { db: { schema }, auth: { persistSession: false, autoRefreshToken: false } });
}
export function createWorkerStore() {
  const db = workerClient();
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
export function createBudgetStore(): BudgetStore {
  const db = workerClient();
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await db.rpc(name, args);
    if (error) {
      const code = /^BUDGET_[A-Z_]+$/.test(error.message) ? error.message : 'BUDGET_STORAGE_UNAVAILABLE';
      throw new Error(code);
    }
    return data;
  }
  return {
    async reserve(q: ProductionQuote) {
      const data = await rpc('budget_reserve', { p_key:q.key,p_month:q.month,p_category:q.category,p_estimate:q.estimateMicros,
        p_story:q.storyId,p_video:q.videoKey,p_tool:q.tool,p_tool_version:q.toolVersion,p_price_version:q.priceVersion,p_input_hash:q.inputHash });
      if (!data?.id) throw new Error('BUDGET_EMPTY_RESULT');
      return { id: data.id, state: data.state };
    },
    async start(id) { const token = await rpc('budget_start', {p_id:id}); if (!token) throw new Error('BUDGET_EMPTY_TOKEN'); return token as string; },
    async release(id) { await rpc('budget_release', {p_id:id}); },
    async uncertain(id,token) { await rpc('budget_uncertain', {p_id:id,p_token:token}); },
    async settle(id,token,actualMicros:number,usage:Usage,reference:string) {
      await rpc('budget_settle', {p_id:id,p_token:token,p_actual:actualMicros,p_usage:usage,p_reference:reference});
    }
  };
}
export function createContentRepository():ContentRepository {
 const db=workerClient();
 async function rpc(name:string,args:Record<string,unknown>) {
  const {data,error}=await db.rpc(name,args);if(error)throw new Error('Content command blocked: '+error.code);return data;
 }
 return {
  input:briefId=>rpc('content_generation_input',{p_brief:briefId}),
  async receipt(operationId){const op=await db.from('budget_operations').select('state').eq('id',operationId).single();if(op.error)throw new Error('Content ledger unavailable');if(op.data.state!=='settled')return null;const {data,error}=await db.from('content_receipts').select('id,response').eq('operation_id',operationId).maybeSingle();if(error)throw new Error('Content receipt unavailable');return data;},
  record:(operationId,briefId,inputHash,kind,response,audit)=>rpc('record_content_receipt',{p_operation:operationId,p_brief:briefId,p_input_hash:inputHash,p_kind:kind,p_response:response,p_audit:audit}),
  save:receiptId=>rpc('save_content_draft',{p_receipt:receiptId})
  ,async feedback(briefId,kind) {
   const d=await db.from('content_drafts').select('id,payload').eq('brief_id',briefId).eq('kind',kind).order('created_at',{ascending:false}).order('id').limit(1).maybeSingle();if(d.error)throw new Error('Content feedback unavailable');if(!d.data)return null;
   const r=await db.from('content_reviews').select('id,decision,reason').eq('draft_id',d.data.id).order('version',{ascending:false}).limit(1).maybeSingle();if(r.error)throw new Error('Content feedback unavailable');
   return r.data?.decision==='request_revision'?{reviewId:r.data.id,draftId:d.data.id,reason:r.data.reason,previousDraft:d.data.payload}:null;
  }
 };
}
