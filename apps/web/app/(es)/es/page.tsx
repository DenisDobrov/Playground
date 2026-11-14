import {NewsHome} from '../../../components/news-listing';
import {newsMetadata,newsReleases} from '../../../lib/news';
import {languages,homePath} from '../../../lib/news-languages';
export const dynamic='force-dynamic';
export async function generateMetadata(){const rows=await newsReleases();return rows.some(r=>r.language==='es')?newsMetadata('es','Ciencia con evidencia','Noticias científicas con fuentes, contexto y límites.',Object.fromEntries(languages.filter(l=>rows.some(r=>r.language===l)).map(l=>[l,homePath(l)]))):{robots:{index:false,follow:false}};}
export default function Page(){return <NewsHome language="es"/>;}
