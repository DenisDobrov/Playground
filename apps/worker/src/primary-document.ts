import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {ProductionJob} from '@science/storage';
export function extractPdf(bytes:Uint8Array):Promise<string[]> {
 if(bytes.byteLength>4194304||Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-') throw new Error('PDF limit: 4 MiB; PDF header required');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./pdf-parser.mjs',import.meta.url),{workerData:bytes,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128}});
  const timer=setTimeout(()=>{void worker.terminate();reject(new Error('PDF timeout'));},20000);
  const stop=()=>clearTimeout(timer);
  worker.once('message',result=>{stop();void worker.terminate();if(result.error) reject(new Error(result.error));else resolve(result.pages);});
  worker.once('error',e=>{stop();reject(e);});worker.once('exit',code=>{stop();if(code!==0) reject(new Error('PDF parser stopped'));});
 });
}
export async function ingestPrimaryPdf(job:ProductionJob) {
 const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{db:{schema:'academy'},auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
 const path=String(job.payload.object||'');if(!/^research-intake\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.pdf$/.test(path)) throw new Error('Invalid PDF intake path');
 const info=await db.storage.from('dobrov-academy-assets').info(path);
 if(info.error||!info.data||Number(info.data.size)>4194304) throw new Error('PDF object unavailable or too large');
 const file=await db.storage.from('dobrov-academy-assets').download(path);if(file.error||!file.data) throw new Error('PDF download failed');
 const bytes=new Uint8Array(await file.data.arrayBuffer());const pages=await extractPdf(bytes);
 const checksum=createHash('sha256').update(bytes).digest('hex');
 const {data,error}=await db.rpc('complete_primary_pdf',{p_job:job.id,p_lease:job.lease_token,p_checksum:checksum,p_pages:pages});
 if(error||!data) throw new Error('PDF persistence failed');return {documentId:data,checksum,pages:pages.length,paidCalls:0};
}
