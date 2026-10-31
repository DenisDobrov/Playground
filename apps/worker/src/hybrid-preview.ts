import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {renderPanFallback,type MediaAssetRevision} from '@science/video';

// Original non-person calibration card. No scientific result or consent is fabricated.
const root=resolve('artifacts/hybrid-preview');await mkdir(root,{recursive:true});
const width=640,height=360,pixels=Buffer.alloc(width*height*3);
for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
 const i=(y*width+x)*3,grid=x%64<2||y%60<2;
 pixels[i]=grid?65:12;pixels[i+1]=grid?190:22+Math.floor(y/12);pixels[i+2]=grid?200:40+Math.floor(x/10);
}
const bytes=Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`),pixels]);
const hash=createHash('sha256').update(bytes).digest('hex'),source=join(root,'technical-card.ppm');await writeFile(source,bytes);
const now=new Date().toISOString();
const asset:MediaAssetRevision={id:'technical-card',version:1,contentHash:hash,assetType:'scientific_visual',ownerId:null,sourceFileHash:hash,privatePath:'technical/technical-card.ppm',originalPrivate:true,consent:null,generator:null,generatedVideoHash:null,syntheticLikeness:false,voiceSource:'none',rightsStatus:'cleared',license:'Project-original calibration graphic',attribution:'Dobrov Academy technical preview',disclosureRequired:false,createdAt:now,durationSeconds:null,approval:null};
if(!process.env.FFMPEG_PATH||!process.env.FFPROBE_PATH)throw new Error('Set absolute FFMPEG_PATH and FFPROBE_PATH to locally installed, trusted binaries');
const request={sourcePath:source,outputDirectory:join(root,'clips'),asset,scriptRevisionId:'technical-preview-only',now,settings:{width:1920,height:1080,fps:30,duration:3,zoomTo:1.04},ffmpeg:resolve(process.env.FFMPEG_PATH)};
const first=await renderPanFallback(request),second=await renderPanFallback(request);
if(!second.reused||first.outputHash!==second.outputHash)throw new Error('Cache idempotency failure');
const probe=spawnSync(resolve(process.env.FFPROBE_PATH),['-v','error','-show_streams','-show_format','-of','json',first.path],{encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:1024*1024});
if(probe.status!==0)throw new Error('ffprobe failed');
const metadata=JSON.parse(probe.stdout),streams=metadata.streams;
if(streams.length!==1||streams[0].codec_name!=='h264'||streams[0].width!==1920||streams[0].height!==1080||Math.abs(Number(metadata.format.duration)-3)>1/30)throw new Error('Technical clip format mismatch');
await writeFile(join(root,'technical.srt'),'1\n00:00:00,000 --> 00:00:03,000\nPRUEBA TÉCNICA — sin voz ni contenido científico\n');
const result={...first,repeatedImportReused:second.reused,probe:metadata,publication:'blocked',reason:'Technical preview only; no approved script, narration or human audiovisual review'};
await writeFile(join(root,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({path:first.path,outputHash:first.outputHash,reused:first.reused,repeatReused:second.reused,hasAudio:false,providerCostMicros:0,publication:'blocked'}));
