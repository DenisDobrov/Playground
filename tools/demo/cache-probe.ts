// Tamper only with a private COPY. The real immutable render/cache are never changed.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {renderPanFallback,type MediaAssetRevision} from '@science/video';
const root=resolve(process.argv[2]||'/out');
const {revision}=JSON.parse(await readFile(join(root,'latest.json'),'utf8'));
const dir=join(root,'revisions',revision),board=JSON.parse(await readFile(join(dir,'storyboard.json'),'utf8')),s=board.scenes[0];
const isolated=join(root,'probes','tamper-'+randomUUID()),copy=join(isolated,s.panInputHash);await mkdir(copy,{recursive:true});
for(const file of ['manifest.json','clip.mp4'])await copyFile(join(root,'cache','pan',s.panInputHash,file),join(copy,file));
await writeFile(join(copy,'clip.mp4'),'intentionally corrupted isolated copy');
const a:MediaAssetRevision={id:s.id,version:1,contentHash:s.imageHash,sourceFileHash:s.imageHash,privatePath:'visuals/'+s.id+'.png',assetType:'scientific_visual',ownerId:null,originalPrivate:true,consent:null,generator:null,generatedVideoHash:null,syntheticLikeness:false,voiceSource:'none',rightsStatus:'cleared',license:'Original private synthetic illustration',attribution:'Dobrov Academy',disclosureRequired:true,createdAt:'2026-11-04T00:00:00Z',durationSeconds:null,approval:null};
await assert.rejects(()=>renderPanFallback({sourcePath:join(dir,'visuals',s.id+'.png'),outputDirectory:isolated,asset:a,scriptRevisionId:'synthetic-demo-v1',now:'2026-11-04T00:00:00Z',settings:{width:1920,height:1080,fps:25,duration:Math.min(s.duration,8),zoomTo:1.01},ffmpeg:'/usr/bin/ffmpeg'}),/Cached clip checksum mismatch/);
const evidence={at:new Date().toISOString(),revision,status:'PASS',probe:'copied pan cache corruption rejected; real immutable artifacts unchanged',paidCalls:0};await writeFile(join(isolated,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
