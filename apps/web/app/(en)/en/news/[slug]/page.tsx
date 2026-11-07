import {NewsArticle} from '../../../../../components/news-public';
import {articleMetadata,newsReleases} from '../../../../../lib/news';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=(await newsReleases()).find(r=>r.language==='en'&&r.slug===slug);
  return r?articleMetadata(r):{robots:{index:false}};
}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <NewsArticle language="en" slug={(await params).slug}/>;}
