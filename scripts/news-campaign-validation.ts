import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {newsPackageSchema,type NewsPackage} from '../packages/core/src/news';

/** Worker/operator boundary: supplied assets cannot claim a different checksum or publication. */
export function validateCampaign(input:unknown,base:NewsPackage):NewsPackage {
  const p=newsPackageSchema.parse(input);
  if(!p.campaign||base.campaign)throw new Error('CAMPAIGN_BASE_REQUIRED');
  const {campaign,channelTexts,...original}=p;
  const {channelTexts:previousTexts,...baseOriginal}=base;
  if(!isDeepStrictEqual(original,baseOriginal))throw new Error('CAMPAIGN_MUST_PRESERVE_PUBLISHED_ARTICLE');
  for(const asset of campaign.assets){
    const bytes=Buffer.from(asset.dataUrl.split(',')[1],'base64');
    if(bytes.length<33||bytes.length>262144||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==asset.width||bytes.readUInt32BE(20)!==asset.height)throw new Error('CAMPAIGN_INVALID_PNG');
    if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('CAMPAIGN_ASSET_HASH_MISMATCH');
  }
  return p;
}
