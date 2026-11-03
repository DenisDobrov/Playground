/// <reference types="next" />
import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('../apps/web/lib/editorial-auth',()=>({editorialClient:vi.fn()}));
vi.mock('../apps/web/lib/editorial-config',()=>({editorialEnabled:vi.fn(()=>true)}));
import {editorialClient} from '../apps/web/lib/editorial-auth';
import {editorialEnabled} from '../apps/web/lib/editorial-config';
import {GET as live} from '../apps/web/app/api/health/route';
import {GET as ready} from '../apps/web/app/api/readiness/route';
const factory=vi.mocked(editorialClient),enabled=vi.mocked(editorialEnabled);
beforeEach(()=>{vi.clearAllMocks();enabled.mockReturnValue(true);});
function client(role:string|null='editor',probeError=false) {
 const c={auth:{getUser:vi.fn(async()=>({data:{user:{id:'synthetic-owner'}},error:null}))},from:vi.fn((table:string)=>({select:()=>table==='editor_members'?{eq:()=>({maybeSingle:async()=>({data:role?{role}:null,error:null})})}:{limit:async()=>({data:[],error:probeError?{message:'PRIVATE DB DETAILS'}:null})}}))};
 factory.mockResolvedValue(c as any);return c;
}
describe('privacy-safe liveness and readiness',()=>{
 it('keeps process liveness independent from DB/worker, uncached and publishing disabled',async()=>{
  const response=live();expect(response.status).toBe(200);expect(await response.json()).toEqual({status:'ok',checks:{web:'alive'},publicationEnabled:false});expect(response.headers.get('cache-control')).toContain('no-store');expect(factory).not.toHaveBeenCalled();
 });
 it('returns generic unavailable when live configuration is disabled or invalid',async()=>{
  enabled.mockReturnValue(false);let response=await ready();expect(response.status).toBe(503);expect(await response.json()).toEqual({status:'unavailable'});
  enabled.mockReturnValue(true);factory.mockRejectedValue(new Error('SECRET_URL=private'));response=await ready();expect(response.status).toBe(503);expect(await response.text()).not.toContain('SECRET_URL');
 });
 it('denies unauthenticated and nonmember callers before dependency queries',async()=>{
  const c=client();c.auth.getUser.mockResolvedValue({data:{user:null},error:null} as any);let response=await ready();expect(response.status).toBe(401);expect(c.from).not.toHaveBeenCalled();
  client(null);response=await ready();expect(response.status).toBe(403);expect(await response.json()).toEqual({status:'unavailable'});
 });
 it('distinguishes invalid session from Auth service outage without disclosing diagnostics',async()=>{
  for(const [status,expected] of [[401,401],[503,503],[0,503]]) {const c=client();c.auth.getUser.mockResolvedValue({data:{user:null},error:{status,message:'PRIVATE AUTH DETAILS'}} as any);const response=await ready();expect(response.status).toBe(expected);expect(await response.text()).not.toContain('PRIVATE');}
 });
 it.each(['editor','reviewer'])('checks actual %s permissions and refuses green status for an unverified worker',async role=>{
  const c=client(role),response=await ready(),body=await response.json();expect(factory).toHaveBeenCalledWith(true,5000);expect(c.from).toHaveBeenCalledTimes(6);expect(response.status).toBe(503);expect(body).toMatchObject({status:'degraded',checks:{web:'alive',editorialDatabase:'ready',worker:'unverified'},publicationEnabled:false});expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('vary')).toBe('Cookie');expect(response.headers.get('retry-after')).toBe('60');
 });
 it('marks missing schema/grants/unreachable DB unavailable, never returns upstream detail',async()=>{
  client('editor',true);const response=await ready();expect(response.status).toBe(503);expect(await response.json()).toMatchObject({status:'unavailable',checks:{editorialDatabase:'unavailable'}});
 });
});
