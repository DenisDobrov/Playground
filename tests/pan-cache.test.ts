import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,mkdir,unlink,rmdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {renderPanFallback,videoContentHash,type MediaAssetRevision} from '@science/video';

it('rejects changed source and corrupted cached bytes without executing a renderer',async()=>{
 const root=resolve('artifacts/pan-cache-tests');await mkdir(root,{recursive:true});
 const dir=await mkdtemp(join(root,'case-')),sourcePath=join(dir,'image.ppm'),ffmpeg=join(dir,'not-an-executable');
 const source=Buffer.concat([Buffer.from('P6\n1 1\n255\n'),Buffer.from([10,20,30])]),binary=Buffer.from('Synthetic renderer identity, never executed');
 const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 const asset:MediaAssetRevision={id:'fixture',version:1,contentHash:hash(source),assetType:'scientific_visual',ownerId:null,sourceFileHash:hash(source),privatePath:'synthetic/image.ppm',originalPrivate:true,consent:null,generator:null,generatedVideoHash:null,syntheticLikeness:false,voiceSource:'none',rightsStatus:'cleared',license:'synthetic fixture',attribution:'Synthetic test',disclosureRequired:false,createdAt:'2026-10-30T00:00:00Z',durationSeconds:null,approval:null};
 const settings={width:1920,height:1080,fps:30,duration:3,zoomTo:1.04};
 const inputHash=videoContentHash({contract:'still-pan/2',source:asset.contentHash,decoder:'ppm',settings,binaryHash:hash(binary)}),cache=join(dir,inputHash);
 await writeFile(sourcePath,source);await writeFile(ffmpeg,binary);await mkdir(cache);
 await writeFile(join(cache,'clip.mp4'),'tampered bytes');await writeFile(join(cache,'manifest.json'),JSON.stringify({inputHash,outputHash:hash(Buffer.from('original clip'))}));
 const request={sourcePath,ffmpeg,asset,outputDirectory:dir,scriptRevisionId:'synthetic',now:'2026-10-31T00:00:00Z',settings};
 try {
  await expect(renderPanFallback(request)).rejects.toThrow('Cached clip checksum mismatch');
  await writeFile(sourcePath,Buffer.concat([source,Buffer.from('changed')]));
  await expect(renderPanFallback(request)).rejects.toThrow('Source image checksum mismatch');
 } finally {
  for(const file of [sourcePath,ffmpeg,join(cache,'clip.mp4'),join(cache,'manifest.json')])await unlink(file);
  await rmdir(cache);await rmdir(dir);
 }
});
