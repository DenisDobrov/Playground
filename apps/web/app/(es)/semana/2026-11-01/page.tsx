import {NewsDigest} from '../../../../components/news-public';
import {digestPath,newsMetadata} from '../../../../lib/news';
export const dynamic='force-dynamic';
export const metadata=newsMetadata('es','La semana en ciencia · 1–7 noviembre 2026','Noticias científicas con fuentes y límites de la evidencia.',{en:digestPath('en'),es:digestPath('es')});
export default function Page(){return <NewsDigest language="es"/>;}
