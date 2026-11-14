import {NewsArticle} from '../../../../../components/news-public';
import {articleMetadata,newsReleases,resolveNewsRelease} from '../../../../../lib/news';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=resolveNewsRelease(await newsReleases(),'en',slug);
  return r?{...articleMetadata(r),...(r.language!=='en'||r.slug!==slug)?{robots:{index:false,follow:true}}:{}}:{robots:{index:false}};
}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <NewsArticle language="en" slug={(await params).slug}/>;}
