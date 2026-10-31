import { randomUUID } from 'node:crypto';
import { requireMember } from '../../../lib/editorial-auth';
import { createCandidate, recordSelection } from './actions';
import { signOut } from '../login/actions';
import { feedFreshness } from '@science/sources';
import { catalogStatuses, catalogDecisions, editorialQuery, catalogUrl, literalSearch, type EditorialParams } from '../../../lib/editorial-query';
const notices: Record<string, string> = { saved: 'Guardado. Los cambios permanecen al recargar.', invalid: 'Revisa los datos del formulario.', failed: 'No se ha guardado. Inténtalo de nuevo; si persiste, contacta con el administrador.', conflict: 'La historia cambió en otra sesión. Revisa la versión actual antes de decidir.' };
const statuses: Record<string, string> = { candidate: 'Pendiente', researching: 'Seleccionada para investigación', review: 'Revisión solicitada', held: 'Retenida', published: 'Publicada' };
const flagLabels: Record<string,string> = { original_date_unknown: 'Falta la fecha del estudio original', older_original: 'Trabajo antiguo: evaluar como contexto', rehash: 'El comunicado retoma una publicación antigua', invalid_or_future_date: 'Fecha inválida o futura', revision_before_original: 'Las fechas de versiones son inconsistentes' };
interface InboxStory {
  id: string; title_en: string; status: string; editorial_version: number;
  story_domains: { domain_id: string }[];
  story_sources: { sources: { canonical_id: string; url: string; metadata: { originalPublishedAt?: string; revisionAt?: string; pressReleaseAt?: string; flags?: string[]; primarySourceRequired?: boolean } } | null }[];
  editorial_decisions: { id: string; decision: string; reason: string; created_at: string; actor_id: string }[];
}
export async function Inbox({ notice, catalog = false, params = {} }: { notice?: string; catalog?: boolean; params?: EditorialParams }) {
  const filters = editorialQuery(params);
  notice ??= typeof params.notice === 'string' ? params.notice : undefined;
  const { client, user, role } = await requireMember();
  let ids: string[] = [];
  let count = 0;
  const pageSize = 20;
  let unavailable = false;
  if (catalog) {
    let search = client.from('editorial_catalog').select('id', { count: 'exact' });
    if (filters.q) search = search.ilike('search_text', literalSearch(filters.q));
    if (filters.domain) search = search.contains('domain_ids', [filters.domain]);
    if (filters.status) search = search.eq('status', filters.status);
    if (filters.decision) search = search.eq('latest_decision', filters.decision);
    const result = await search.order('created_at', { ascending: false }).order('id').range((filters.page - 1) * pageSize, filters.page * pageSize - 1);
    unavailable = !!result.error && ['PGRST205', '42P01'].includes(result.error.code);
    if (result.error && !unavailable && result.error.code !== 'PGRST103') throw new Error('Editorial catalog is unavailable');
    ids = result.data?.map(row => row.id) || [];
    count = result.count || 0;
  }
  let query = client.from('stories').select('id,title_en,status,editorial_version,story_domains(domain_id),story_sources(sources(canonical_id,url,metadata)),editorial_decisions(id,decision,reason,created_at,actor_id)');
  if (catalog) query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  else query = query.eq('status', 'candidate').eq('editorial_version', 0);
  const { data: stories, error } = await query.order('created_at', { ascending: false }).order('id').limit(catalog ? pageSize : 50).overrideTypes<InboxStory[], { merge: false }>();
  const { data: feeds, error: feedError } = await client.from('feed_state').select('id,checked_at,latest_entry_at,last_error');
  if (feedError && !['PGRST205','42P01'].includes(feedError.code)) throw new Error('Feed status is unavailable');
  if (error) throw new Error('Editorial inbox is unavailable');
  const storyIds=stories?.map(s=>s.id)||[];
  const provenance=storyIds.length ? await client.from('external_review_items').select('story_id,review_id').in('story_id',storyIds) : {data:[],error:null};
  const scientificEvents=storyIds.length ? await client.from('scientific_events').select('story_id,kind,reported_date,needs_review').in('story_id',storyIds).order('reported_at',{ascending:false}).limit(100) : {data:[],error:null};
  const resolutions=storyIds.length ? await client.from('pending_resolutions').select('story_id,item_id,version').in('story_id',storyIds).order('version',{ascending:false}).limit(100) : {data:[],error:null};
  for(const result of [provenance,scientificEvents,resolutions]) if(result.error && !['PGRST205','42P01'].includes(result.error.code)) throw new Error('External review provenance is unavailable');
  return <main>
    <div className="editorial-heading"><div><p className="eyebrow">REDACCIÓN / SHADOW MODE</p><h1>{catalog ? 'Todas las historias.' : 'Nuevas historias.'}</h1><p>{user.email} · {role === 'editor' ? 'Editor' : 'Revisor · solo lectura'}</p></div><form action={signOut}><button type="submit">Cerrar sesión</button></form></div>
    <nav className="editorial-navigation" aria-label="Vistas editoriales"><a href="/editorial" aria-current={!catalog ? 'page' : undefined}>Nuevas · sin decisión</a><a href="/editorial/stories" aria-current={catalog ? 'page' : undefined}>Todas las historias</a><a href="/editorial/imports">Informes externos</a><a href="/editorial/budget">Presupuesto</a></nav>
    <p>Fuentes registradas para revisión. Seleccionar una historia no verifica sus afirmaciones ni la publica.</p>
    <details><summary>Estado de las fuentes</summary>{feedError ? <p>Las fuentes automáticas todavía no están activadas en esta base.</p> : <ul>{feeds?.map(f => <li key={f.id}>{f.id}: {feedFreshness(f.latest_entry_at,new Date().toISOString())} · {f.last_error || 'sin error'} · {f.checked_at || 'sin comprobar'}</li>)}</ul>}</details>
    {notice && notices[notice] && <p className="editorial-notice" role="status">{notices[notice]}</p>}
    {role === 'editor' && !catalog && <section className="intake-panel"><h2>Añadir una fuente</h2><form action={createCandidate} className="intake-form">
      <label>DOI o arXiv<input name="identifier" required maxLength={500} placeholder="10.1234/ejemplo o arXiv:2401.12345" /></label>
      <label>Título original en inglés<input name="title" required minLength={3} maxLength={500} /></label>
      <label>Área<select name="domain"><option value="ai">Inteligencia artificial</option><option value="physics">Física y espacio</option></select></label><button type="submit">Añadir a la bandeja</button>
    </form><p>Se registra el identificador y se programa su normalización. El texto científico y la fecha original aún requieren comprobación.</p></section>}
    {catalog && <section className="intake-panel"><h2>Buscar y filtrar</h2><form action="/editorial/stories" className="intake-form">
      <label>Buscar por título, DOI/arXiv o motivo<input type="search" name="q" maxLength={200} defaultValue={filters.q} /></label>
      <label>Área<select name="domain" defaultValue={filters.domain}><option value="">Todas las áreas</option><option value="ai">Inteligencia artificial</option><option value="physics">Física y espacio</option></select></label>
      <label>Estado<select name="status" defaultValue={filters.status}><option value="">Todos los estados</option>{catalogStatuses.map(value => <option key={value} value={value}>{statuses[value]}</option>)}</select></label>
      <label>Última decisión humana<select name="decision" defaultValue={filters.decision}><option value="">Todas las decisiones</option>{catalogDecisions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button type="submit">Buscar</button><a href="/editorial/stories">Limpiar filtros</a>
    </form><p role="status">{count} historias · página {filters.page}</p>{unavailable && <p>El catálogo requiere la migración 007 en esta base.</p>}</section>}
    <section aria-label="Historias candidatas" className="candidate-list">
      {!stories?.length && <p>{catalog ? 'No hay historias con estos filtros.' : 'No quedan historias nuevas en esta tanda. Las decisiones guardadas están en Todas las historias.'}</p>}
      {stories?.map(story => <article className="candidate-card" key={story.id}>
        <p className="eyebrow">{story.story_domains.map(d => d.domain_id).join(' / ')} · {statuses[story.status] || story.status}</p><h2>{story.title_en}</h2>
        {[...new Set(provenance.data?.filter(p=>p.story_id===story.id).map(p=>p.review_id))].map(id=><p key={id}><a href={'/editorial/imports/'+id}>Informe externo original · sin verificar</a></p>)}
        {[...new Set(resolutions.data?.filter(r=>r.story_id===story.id).map(r=>r.item_id))].map(id=><p key={id}><a href={'/editorial/metadata?item='+id}>Resolución de identidad · historial y original</a></p>)}
        {scientificEvents.data?.filter(e=>e.story_id===story.id).map((e,i)=><p className="notice" key={i}>Evento comunicado: {e.kind} · {e.reported_date||'fecha no indicada'} · sin verificar{e.needs_review ? ' · revisión pendiente' : ''}</p>)}
        {story.story_sources.map((link, i) => link.sources && <div key={i}><a href={link.sources.url} rel="noreferrer" target="_blank">{link.sources.canonical_id} ↗</a><p><a href={'/editorial/metadata?identity='+encodeURIComponent(link.sources.canonical_id)}>Metadatos primarios y relaciones revisadas</a></p><p>Publicación original: {link.sources.metadata.originalPublishedAt || 'pendiente de verificar'}<br />Revisión: {link.sources.metadata.revisionAt || '—'} · Comunicado: {link.sources.metadata.pressReleaseAt || '—'}</p>{link.sources.metadata.primarySourceRequired && <p className="notice">Comunicado institucional: falta identificar el estudio primario.</p>}{link.sources.metadata.flags?.length ? <p className="notice">Revisar: {link.sources.metadata.flags.map(f=>flagLabels[f] || 'Comprobar los datos de origen').join('; ')}</p> : null}</div>)}
        {role === 'editor' && story.status !== 'published' && <form action={recordSelection} className="decision-form">
          <input type="hidden" name="returnTo" value={catalog ? catalogUrl(filters) : '/editorial'} /><input type="hidden" name="storyId" value={story.id} /><input type="hidden" name="version" value={story.editorial_version} /><input type="hidden" name="requestId" value={randomUUID()} />
          <label>Decisión<select name="decision"><option value="select">Seleccionar</option><option value="reject">Descartar</option><option value="hold">Retener / contexto</option><option value="revise">Solicitar revisión</option></select></label>
          <label>Motivo<textarea name="reason" required minLength={3} maxLength={2000} rows={2} /></label><button type="submit">Guardar decisión</button>
        </form>}
        <details><summary>Historial de decisiones ({story.editorial_decisions.length})</summary><ol>{[...story.editorial_decisions].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(d => <li key={d.id}><strong>{d.decision}</strong> · {d.reason}<br /><small>{d.created_at} · {d.actor_id}</small></li>)}</ol></details>
      </article>)}
    </section>
    {catalog ? <nav className="editorial-navigation" aria-label="Paginación">{filters.page > 1 && <a href={catalogUrl(filters, filters.page - 1)}>← Anterior</a>}{filters.page * pageSize < count && <a href={catalogUrl(filters, filters.page + 1)}>Siguiente →</a>}</nav> : (stories?.length === 50 && <p>Se muestran hasta 50 historias nuevas. Al decidir aparecerán las siguientes.</p>)}
  </main>;
}
