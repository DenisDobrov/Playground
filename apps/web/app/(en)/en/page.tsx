import {NewsHome} from '../../../components/news-listing';
import {newsMetadata,newsReleases} from '../../../lib/news';
import {languages,homePath} from '../../../lib/news-languages';
export const dynamic='force-dynamic';
export async function generateMetadata(){const rows=await newsReleases();return rows.some(r=>r.language==='en')?newsMetadata('en','Science with evidence','Research news with sources, context and limits.',Object.fromEntries(languages.filter(l=>rows.some(r=>r.language===l)).map(l=>[l,homePath(l)]))):{robots:{index:false,follow:false}};}
export default function Page(){return <NewsHome language="en"/>;}
