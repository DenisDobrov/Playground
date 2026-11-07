import {describe,expect,it,vi} from 'vitest';
import {inspectGeminiModel} from '../packages/llm/src/gemini-readiness';
describe('Gemini metadata-only readiness boundary',()=>{
 it('does not request anything without a credential',async()=>{const transport=vi.fn();expect((await inspectGeminiModel('','gemini-3-flash-preview',transport)).metadataRequests).toBe(0);expect(transport).not.toHaveBeenCalled();});
 it('uses only fixed-host GET, rejects redirects, and emits selected metadata',async()=>{
  const transport=vi.fn().mockResolvedValue(new Response(JSON.stringify({name:'models/gemini-3-flash-preview',inputTokenLimit:1048576,outputTokenLimit:65536,supportedGenerationMethods:['generateContent'],providerSecret:'private'})));
  const result=await inspectGeminiModel('synthetic-key','gemini-3-flash-preview',transport);
  expect(transport.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview');
  expect(transport.mock.calls[0][1]).toMatchObject({method:'GET',redirect:'error'});expect(result.status).toBe('available');expect(JSON.stringify(result)).not.toMatch(/synthetic-key|providerSecret|private/);
 });
 it('never retries or echoes provider error messages',async()=>{
  const transport=vi.fn().mockResolvedValue(new Response('synthetic-key',{status:403}));
  const result=await inspectGeminiModel('synthetic-key','gemini-3-flash-preview',transport);
  expect(result).toMatchObject({status:'unavailable',httpStatus:403});expect(transport).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain('synthetic-key');
 });
 it('rejects model-path injection before a request',async()=>{const transport=vi.fn();await expect(inspectGeminiModel('synthetic-key','../generateContent',transport)).rejects.toThrow();expect(transport).not.toHaveBeenCalled();});
});
