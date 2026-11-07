import {NewsArticle} from '../../../../../components/news-public';
import {newsMetadata,newsPath,newsReleases} from '../../../../../lib/news';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;const r=(await newsReleases()).find(r=>r.language==='en'&&r.slug===slug);
  return r?newsMetadata('en',r.content.article.title,r.content.article.paragraphs[0],{en:newsPath('en',slug),es:newsPath('es',slug)},r.published_at):{robots:{index:false}};
}
export default async function Page({params}:{params:Promise<{slug:string}>}){return <NewsArticle language="en" slug={(await params).slug}/>;}
