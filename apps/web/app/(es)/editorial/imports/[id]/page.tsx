import {requireMember} from '../../../../../lib/editorial-auth';
import {editorialEnabled} from '../../../../../lib/editorial-config';
import {notFound} from 'next/navigation';
import type {ReviewCandidate} from '@science/sources';
export const dynamic='force-dynamic';
export default async function ImportedReview({params}:{params:Promise<{id:string}>}) {
  if(!editorialEnabled()) return <main><p>El archivo requiere la redacción conectada.</p></main>;
  const {client}=await requireMember();const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const {data:review,error}=await client.from('external_reviews').select('*').eq('id',id).maybeSingle();
  if(error) throw new Error('Review is unavailable');if(!review) notFound();
  const {data:items,error:itemError}=await client.from('external_review_items').select('id,item_key,story_id,disposition,selected_identity,verification,extraction').eq('review_id',id).order('item_key');
  if(itemError) throw new Error('Imported sections are unavailable');
  const ids=items?.map(i=>i.id)||[];
  const {data:events,error:eventError}=ids.length ? await client.from('scientific_events').select('id,story_id,kind,reported_date,verification,needs_review,revision').in('review_item_id',ids) : {data:[],error:null};
  if(eventError) throw new Error('Reported events are unavailable');
  return <main><h1>Informe importado.</h1><nav className="editorial-navigation"><a href="/editorial/imports">Informes externos</a><a href="/editorial">Nuevas</a><a href="/editorial/stories">Todas las historias</a></nav>
    <p>Origen: {review.source_type} · importado: {review.imported_at} · parser: {review.parser_version}</p><p className="review-hash">SHA-256: {review.content_hash}</p>
    <p>Selección guardada. Volver a importar el mismo informe reutiliza las secciones existentes; una selección adicional se añade al mismo original.</p>
    {items?.map(item=>{const c=item.extraction as ReviewCandidate;return <article className="candidate-card" key={item.id}><h2>{c.title}</h2><p>{item.disposition} · {item.verification} · {item.selected_identity||'identificación pendiente'}</p>
      {item.story_id && <p>Historia: {item.story_id}. <a href={'/editorial/stories?q='+encodeURIComponent(item.selected_identity||c.title)}>Abrir en el catálogo</a></p>}
      <p>Líneas del original: {c.startLine}–{c.endLine} · categoría declarada: {c.category}</p><p>Falta verificación científica y evidence con citas/locators del documento primario.</p>
      <details><summary>Sección original y procedencia</summary><pre className="review-text">{c.rawSection}</pre></details>
    </article>})}
    <h2>Eventos comunicados · sin verificar</h2><p>Un evento nuevo es una petición de revisión, no una corrección científica confirmada. Las revisiones publicadas y sus aprobaciones no se modifican.</p>
    <ul>{events?.map(e=><li key={e.id}>{e.kind} · {e.reported_date||'fecha no indicada'} · {e.revision ? 'v'+e.revision : ''} · {e.verification} · {e.needs_review ? 'revisión pendiente' : ''}</li>)}</ul>
    <details><summary>Markdown original completo</summary><pre className="review-text" data-testid="original-review">{review.markdown}</pre></details>
  </main>;
}
