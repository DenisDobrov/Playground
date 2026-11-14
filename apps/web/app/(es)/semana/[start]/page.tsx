import {NewsDigest} from '../../../../components/news-public';
import {digestPath,newsReleases,newsMetadata} from '../../../../lib/news';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{start:string}>}){const {start}=await params,rows=(await newsReleases()).filter(r=>r.content.period.startsWith(start+'/'));return rows.length?newsMetadata('es','La semana en ciencia · '+start,'Fuentes originales, contexto y límites.',Object.fromEntries(rows.map(r=>[r.language,digestPath(r.language,start)]))):{robots:{index:false}};}
export default async function Page({params}:{params:Promise<{start:string}>}){return <NewsDigest language="es" start={(await params).start}/>;}
