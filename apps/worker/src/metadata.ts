import {createClient} from '@supabase/supabase-js';
import {fetchPrimaryMetadata,metadataEndpoint,parsePrimaryMetadata} from '@science/sources';
/** Free metadata only. Durable provider lock shared with feed intake; no in-process retry loop. */
export async function enrichMetadata(input:string) {
  const {identity}=metadataEndpoint(input);
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{db:{schema:'academy'},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:cached,error:cacheError}=await db.from('metadata_fetches').select('snapshot_id,metadata_snapshots!inner(adapter_version)').eq('identity',identity).eq('status',200).eq('metadata_snapshots.adapter_version','primary-metadata/1')
    .gte('fetched_at',new Date(Date.now()-86400000).toISOString()).order('fetched_at',{ascending:false}).limit(1);
  if(cacheError) throw new Error('METADATA_CACHE_FAILED');
  if(cached?.length) return {snapshotId:cached[0].snapshot_id,cached:true,paidCalls:0};
  const {data:token,error}=await db.rpc('claim_metadata',{p_identity:identity});
  if(error||!token) throw new Error('METADATA_DEFERRED');
  let finished=false;
  try {
    const response=await fetchPrimaryMetadata(identity);
    const normalized=response.status===200?parsePrimaryMetadata(identity,response.text):null;
    const {data,error:saveError}=await db.rpc('finish_metadata',{p_identity:identity,p_token:token,p_status:response.status,
      p_raw:response.status===200?response.text:null,p_normalized:normalized,p_delay:[429,503].includes(response.status)?response.retryAfterSeconds:3});
    if(saveError) throw new Error('METADATA_SAVE_FAILED');
    finished=true;
    if(!data) throw new Error('METADATA_UNAVAILABLE');
    return {snapshotId:data,cached:false,paidCalls:0};
  } finally {
    if(!finished) await db.rpc('finish_metadata',{p_identity:identity,p_token:token,p_status:0,p_raw:null,p_normalized:null,p_delay:60});
  }
}
