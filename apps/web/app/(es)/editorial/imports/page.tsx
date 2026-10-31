import {requireMember} from '../../../../lib/editorial-auth';
import {editorialEnabled} from '../../../../lib/editorial-config';
import {ImportForm} from './import-form';
export const dynamic='force-dynamic';
export default async function Imports() {
  if(!editorialEnabled()) return <main><h1>Importar un informe</h1><p>El importador requiere la redacción conectada. La demo no guarda candidatos.</p><a href="/editorial">Volver</a></main>;
  const {client,role}=await requireMember();
  const {data,error}=await client.from('external_reviews').select('id,source_type,imported_at,content_hash').order('imported_at',{ascending:false}).limit(50);
  if(error && !['PGRST205','42P01'].includes(error.code)) throw new Error('Review archive is unavailable');
  return <main><p className="eyebrow">REDACCIÓN / SCI-001</p><h1>Importar un informe científico.</h1>
    <nav className="editorial-navigation"><a href="/editorial">Nuevas</a><a href="/editorial/stories">Todas las historias</a><a href="/editorial/imports" aria-current="page">Informes externos</a><a href="/editorial/budget">Presupuesto</a></nav>
    <p>Los informes externos son análisis secundarios. Sus afirmaciones no se convierten en evidencia verificada.</p>
    {error ? <p>Esta base requiere la migración 009 antes de confirmar una importación.</p> : null}
    {role==='editor' && <ImportForm/>}
    <h2>Últimos 50 informes guardados</h2><ul>{data?.map(r=><li key={r.id}><a href={'/editorial/imports/'+r.id}>{r.source_type} · {r.imported_at}</a> · {r.content_hash.slice(0,12)}</li>)}</ul>
    {role==='reviewer' && <p>Acceso de lectura: solo un editor puede preparar y confirmar importaciones.</p>}
  </main>;
}
