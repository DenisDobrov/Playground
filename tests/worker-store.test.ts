import {beforeEach,describe,expect,it,vi} from 'vitest';
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc})}));
import {createWorkerStore} from '../packages/storage/src';
describe('acceptance queue routing',()=>{
  beforeEach(()=>{
    vi.stubEnv('SUPABASE_URL','http://127.0.0.1:56321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-test-key');
    vi.stubEnv('SUPABASE_DB_SCHEMA','academy');
    rpc.mockReset();
  });
  it('preserves normal queue routing',async()=>{
    rpc.mockResolvedValue({data:[],error:null});
    expect(await createWorkerStore().claim()).toBeNull();
    expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_job');
  });
  it('routes acceptance only through the scoped RPC',async()=>{
    rpc.mockResolvedValue({data:[],error:null});
    expect(await createWorkerStore(true).claim()).toBeNull();
    expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_worker_acceptance_job');
  });
  it('fails closed if the scoped RPC is unavailable; never falls back',async()=>{
    rpc.mockResolvedValue({data:null,error:{code:'PGRST202'}});
    await expect(createWorkerStore(true).claim()).rejects.toThrow('PGRST202');
    expect(rpc).toHaveBeenCalledExactlyOnceWith('claim_worker_acceptance_job');
  });
});
