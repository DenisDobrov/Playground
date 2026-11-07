import {NewsHome} from '../../components/news-listing';
import {newsMetadata,newsReleases} from '../../lib/news';
export const dynamic='force-dynamic';
export async function generateMetadata(){return (await newsReleases()).length?newsMetadata('es','Ciencia con evidencia','Noticias científicas con fuentes, contexto y límites.',{en:'/en',es:'/'}):{robots:{index:false,follow:false}};}
export default function Page(){return <NewsHome language="es"/>;}
