import {NewsDigest} from '../../../../../components/news-public';
import {digestPath,newsMetadata} from '../../../../../lib/news';
export const dynamic='force-dynamic';
export const metadata=newsMetadata('en','The week in science · 1–7 November 2026','Research news with sources and limits of the evidence.',{en:digestPath('en'),es:digestPath('es')});
export default function Page(){return <NewsDigest language="en"/>;}
