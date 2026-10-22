import { randomUUID } from 'node:crypto';
import { requireMember } from '../../lib/editorial-auth';
import { createCandidate, recordSelection } from './actions';
import { signOut } from '../login/actions';
const notices: Record<string, string> = { saved: 'Guardado. Los cambios permanecen al recargar.', invalid: 'Revisa los datos del formulario.', failed: 'No se ha guardado. Inténtalo de nuevo; si persiste, contacta con el administrador.', conflict: 'La historia cambió en otra sesión. Revisa la versión actual antes de decidir.' };
const statuses: Record<string, string> = { candidate: 'Pendiente', researching: 'Seleccionada para investigación', review: 'Revisión solicitada', held: 'Retenida', published: 'Publicada' };
interface InboxStory {
  id: string; title_en: string; status: string; editorial_version: number;
  story_domains: { domain_id: string }[];
  story_sources: { sources: { canonical_id: string; url: string } | null }[];
  editorial_decisions: { id: string; decision: string; reason: string; created_at: string; actor_id: string }[];
}
export async function Inbox({ notice }: { notice?: string }) {
  const { client, user, role } = await requireMember();
  const { data: stories, error } = await client.from('stories').select('id,title_en,status,editorial_version,story_domains(domain_id),story_sources(sources(canonical_id,url)),editorial_decisions(id,decision,reason,created_at,actor_id)').order('created_at', { ascending: false }).limit(50).overrideTypes<InboxStory[], { merge: false }>();
  if (error) throw new Error('Editorial inbox is unavailable');
  return <main>
    <div className="editorial-heading"><div><p className="eyebrow">REDACCIÓN / SHADOW MODE</p><h1>Bandeja editorial.</h1><p>{user.email} · {role === 'editor' ? 'Editor' : 'Revisor · solo lectura'}</p></div><form action={signOut}><button type="submit">Cerrar sesión</button></form></div>
    <p>Fuentes registradas para revisión. Seleccionar una historia no verifica sus afirmaciones ni la publica.</p>
    {notice && notices[notice] && <p className="editorial-notice" role="status">{notices[notice]}</p>}
    {role === 'editor' && <section className="intake-panel"><h2>Añadir una fuente</h2><form action={createCandidate} className="intake-form">
      <label>DOI o arXiv<input name="identifier" required maxLength={500} placeholder="10.1234/ejemplo o arXiv:2401.12345" /></label>
      <label>Título original en inglés<input name="title" required minLength={3} maxLength={500} /></label>
      <label>Área<select name="domain"><option value="ai">Inteligencia artificial</option><option value="physics">Física y espacio</option></select></label><button type="submit">Añadir a la bandeja</button>
    </form><p>Se registra el identificador y se programa su normalización. El texto científico y la fecha original aún requieren comprobación.</p></section>}
    <section aria-label="Historias candidatas" className="candidate-list">
      {!stories?.length && <p>La bandeja está vacía. Añade una fuente para empezar.</p>}
      {stories?.map(story => <article className="candidate-card" key={story.id}>
        <p className="eyebrow">{story.story_domains.map(d => d.domain_id).join(' / ')} · {statuses[story.status] || story.status}</p><h2>{story.title_en}</h2>
        {story.story_sources.map((link, i) => link.sources && <p key={i}><a href={link.sources.url} rel="noreferrer" target="_blank">{link.sources.canonical_id} ↗</a> · Fecha original pendiente de verificación</p>)}
        {role === 'editor' && story.status !== 'published' && <form action={recordSelection} className="decision-form">
          <input type="hidden" name="storyId" value={story.id} /><input type="hidden" name="version" value={story.editorial_version} /><input type="hidden" name="requestId" value={randomUUID()} />
          <label>Decisión<select name="decision"><option value="select">Seleccionar</option><option value="reject">Descartar</option><option value="hold">Retener / contexto</option><option value="revise">Solicitar revisión</option></select></label>
          <label>Motivo<textarea name="reason" required minLength={3} maxLength={2000} rows={2} /></label><button type="submit">Guardar decisión</button>
        </form>}
        <details><summary>Historial de decisiones ({story.editorial_decisions.length})</summary><ol>{[...story.editorial_decisions].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(d => <li key={d.id}><strong>{d.decision}</strong> · {d.reason}<br /><small>{d.created_at} · {d.actor_id}</small></li>)}</ol></details>
      </article>)}
    </section>
  </main>;
}
