import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,open,unlink,rename,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {mediaAssetIssues,type MediaAssetRevision} from './hybrid';
import {videoContentHash} from './scene-plan';
export interface PanSettings {width:number;height:number;fps:number;duration:number;zoomTo:number}
type StillDecoder='png'|'mjpeg'|'ppm'|'webp';
export function panFallbackArgs(input:string,output:string,s:PanSettings,decoder:StillDecoder='png'):string[] {
 if(![s.width,s.height,s.fps].every(Number.isSafeInteger)||s.width<16||s.width>1920||s.height<16||s.height>1080||s.width%2||s.height%2||s.fps<1||s.fps>60||!Number.isFinite(s.duration)||s.duration<=0||s.duration>8||!Number.isFinite(s.zoomTo)||s.zoomTo<1||s.zoomTo>1.08) throw new Error('Bounded pan settings required');
 const frames=Math.ceil(s.duration*s.fps);
 const filter=`scale=${s.width*2}:-2,zoompan=z='min(${s.zoomTo},1+${s.zoomTo-1}*on/${Math.max(1,frames-1)})':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${s.width}x${s.height}:fps=${s.fps},format=yuv420p`;
 return ['-hide_banner','-loglevel','error','-n','-max_alloc','67108864','-protocol_whitelist','file,pipe','-f','image2','-c:v',decoder,'-loop','1','-framerate',String(s.fps),'-i',input,'-vf',filter,'-frames:v',String(frames),'-an','-map_metadata','-1','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',output];
}
export function runBoundedFfmpeg(executable:string,args:string[],cwd:string):Promise<void> {
 return new Promise((resolvePromise,reject)=>{
  const process=spawn(executable,args,{cwd,shell:false,windowsHide:true,stdio:['ignore','ignore','pipe']});let errorTail='';let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;process.kill();},45000);
  process.stderr.on('data',d=>{errorTail=(errorTail+d.toString()).slice(-1600);});
  process.once('error',e=>{clearTimeout(timer);reject(e);});process.once('close',code=>{clearTimeout(timer);code===0&&!timedOut?resolvePromise():reject(new Error(timedOut?'FFmpeg timeout':'FFmpeg failed: '+errorTail));});
 });
}
/** Silent technical clip, not a recorded statement, approved presenter segment or a complete scientific video. */
export async function renderPanFallback(input:{sourcePath:string;outputDirectory:string;asset:MediaAssetRevision;scriptRevisionId:string;now:string;settings:PanSettings;ffmpeg:string}) {
 const errors=mediaAssetIssues(input.asset,input.scriptRevisionId,input.asset.ownerId?'still_motion':null,input.now);if(errors.length) throw new Error(errors.join('; '));
 if(!['scientific_visual','presenter_photo'].includes(input.asset.assetType)) throw new Error('Fallback needs an approved still image');
 panFallbackArgs('input','output',input.settings);
 const sourceStat=await stat(input.sourcePath);if(!sourceStat.isFile()||sourceStat.size>20*1024*1024) throw new Error('Still image limit: regular file up to 20 MiB');
 const source=await readFile(input.sourcePath);if(source.length>20*1024*1024) throw new Error('Still image limit: 20 MiB');
 const decoder:StillDecoder|null=source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':source[0]===255&&source[1]===216&&source[2]===255?'mjpeg':source.subarray(0,2).toString()==='P6'?'ppm':source.subarray(0,4).toString()==='RIFF'&&source.subarray(8,12).toString()==='WEBP'?'webp':null;
 if(!decoder)throw new Error('Supported still formats: PNG, JPEG, binary PPM, WebP');
 const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');if(sha(source)!==input.asset.contentHash) throw new Error('Source image checksum mismatch');
 // Renderer binary identity is part of the cache key, not just its executable path.
 const binaryHash=sha(await readFile(input.ffmpeg));
 const inputHash=videoContentHash({contract:'still-pan/2',source:input.asset.contentHash,decoder,settings:input.settings,binaryHash});
 const dir=resolve(input.outputDirectory,inputHash);await mkdir(dir,{recursive:true});const manifest=join(dir,'manifest.json'),clip=join(dir,'clip.mp4');
 let cached:any=null;
 try {cached=JSON.parse(await readFile(manifest,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(cached) {
  let bytes:Buffer;try{bytes=await readFile(clip);}catch{throw new Error('Incomplete clip cache requires operator inspection');}
  if(cached.inputHash!==inputHash||cached.outputHash!==sha(bytes)) throw new Error('Cached clip checksum mismatch');
  return {...cached,path:clip,reused:true};
 }
 const lock=await open(join(dir,'render.lock'),'wx');const temp=join(dir,'clip-'+randomUUID()+'.mp4'),still=join(dir,'source-'+randomUUID()+'.image');
 try {
  // -n will not overwrite an incomplete prior final artifact. Worker leases own live retries.
  try {await readFile(clip);throw new Error('Incomplete clip cache requires operator inspection');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  // Render the exact validated bytes, not a mutable caller path or arbitrary media playlist.
  await writeFile(still,source,{flag:'wx'});
  await runBoundedFfmpeg(input.ffmpeg,panFallbackArgs(still,temp,input.settings,decoder),dir);
  const outputHash=sha(await readFile(temp));await rename(temp,clip);
  const result={contract:'still-pan/2',inputHash,outputHash,binaryHash,settings:input.settings,hasAudio:false,visualReviewStatus:'pending',syntheticLikeness:input.asset.syntheticLikeness,disclosureRequired:input.asset.disclosureRequired,providerCostMicros:0};
  await writeFile(manifest,JSON.stringify(result,null,2),{flag:'wx'});return {...result,path:clip,reused:false};
 } finally {await lock.close();await unlink(join(dir,'render.lock'));await unlink(temp).catch(()=>{});await unlink(still).catch(()=>{});}
}
