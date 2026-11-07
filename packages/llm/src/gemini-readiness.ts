/** Metadata only: no inference, token counting, billing mutation or automatic retry. */
export async function inspectGeminiModel(key:string,model:string,transport:typeof fetch=fetch) {
  if(!/^gemini-[a-z0-9.-]+$/.test(model))throw new Error('Invalid Gemini model name');
  if(!key.trim())return {model,status:'missing_key' as const,metadataRequests:0};
  try {
    const response=await transport('https://generativelanguage.googleapis.com/v1beta/models/'+model,{
      method:'GET',redirect:'error',headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(10000)
    });
    if(!response.ok) return {model,status:'unavailable' as const,httpStatus:response.status,metadataRequests:1};
    const reader=response.body?.getReader();if(!reader)throw new Error('Missing model response');
    const chunks:Uint8Array[]=[];let size=0;
    try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536)throw new Error('Metadata response too large');chunks.push(part.value);}}
    finally {await reader.cancel().catch(()=>{});}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(body.name!=='models/'+model||!Number.isSafeInteger(body.inputTokenLimit)||!Number.isSafeInteger(body.outputTokenLimit)||!Array.isArray(body.supportedGenerationMethods))throw new Error('Unexpected model metadata');
    return {model,status:'available' as const,httpStatus:response.status,metadataRequests:1,
      version:typeof body.version==='string'?body.version:undefined,inputTokenLimit:body.inputTokenLimit,outputTokenLimit:body.outputTokenLimit,
      supportsGenerateContent:body.supportedGenerationMethods.includes('generateContent')};
  } catch {return {model,status:'unavailable' as const,metadataRequests:1};}
}
