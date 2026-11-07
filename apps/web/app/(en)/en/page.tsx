import {NewsDigest} from '../../../components/news-public';
import {newsMetadata,newsReleases} from '../../../lib/news';
export const dynamic='force-dynamic';
export async function generateMetadata(){return (await newsReleases()).length?newsMetadata('en','Science with evidence','Research news with sources, context and limits.',{en:'/en',es:'/'}):{robots:{index:false,follow:false}};}
export default function Page(){return <NewsDigest language="en" home/>;}
