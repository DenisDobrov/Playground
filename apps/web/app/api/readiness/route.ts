import {editorialClient} from '../../../lib/editorial-auth';
import {editorialEnabled} from '../../../lib/editorial-config';

export const dynamic='force-dynamic';
export const maxDuration=10;
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
function unavailable(status=503) {
 return Response.json({status:'unavailable'},{status,headers:{...headers,...(status===503?{'Retry-After':'60'}:{})}});
}
/** Private dependency readiness. Never use an anonymous/public-key RLS-empty query as proof of readiness. */
export async function GET() {
 if(!editorialEnabled())return unavailable();
 try {
  // Shared five-second network deadline covers Auth, membership and bounded capability probes.
  // Route handlers can persist normal Auth cookie refresh; this grants no database write rights.
  const client=await editorialClient(true,5000);
  const auth=await client.auth.getUser();
  if(auth.error)return unavailable([400,401,403].includes(auth.error.status||0)?401:503);
  if(!auth.data.user)return unavailable(401);
  const membership=await client.from('editor_members').select('role').eq('user_id',auth.data.user.id).maybeSingle();
  if(membership.error)return unavailable();
  if(!membership.data||!['editor','reviewer'].includes(membership.data.role))return unavailable(403);
  const probes=await Promise.all(['editorial_catalog','production_jobs','metadata_snapshots','primary_documents','editorial_briefs'].map(table=>client.from(table).select('id').limit(1)));
  const editorialReady=probes.every(p=>!p.error);
  // There is no deployed worker heartbeat/attestation contract. A successful web probe or old job
  // completion must never manufacture worker readiness. Add verified evidence before changing this.
  return Response.json({status:editorialReady?'degraded':'unavailable',checks:{web:'alive',editorialDatabase:editorialReady?'ready':'unavailable',worker:'unverified'},publicationEnabled:false,checkedAt:new Date().toISOString()},
   {status:503,headers:{...headers,'Retry-After':'60'}});
 } catch {
  // No upstream error, schema name, project URL, key, identity, job state or internal log escapes.
  return unavailable();
 }
}
