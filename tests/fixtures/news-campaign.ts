import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {NewsPackage} from '../../packages/core/src/news';
export function campaignFixture(base:NewsPackage,id='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64)):NewsPackage {
 const bytes=readFileSync(new URL('./news-campaign.png',import.meta.url));
 return {...base,campaign:{id:'synthetic-campaign',title:'Synthetic campaign',basePackageId:id,basePackageHash:hash,assets:(['es','en'] as const).map(language=>({language,alt:'Synthetic plain card',mime:'image/png',width:1080,height:1350,sha256:createHash('sha256').update(bytes).digest('hex'),dataUrl:'data:image/png;base64,'+bytes.toString('base64'),rights:'original_dobrov_academy_typography'}))}};
}
