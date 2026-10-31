import {randomUUID} from 'node:crypto';
import {requireMember} from '../../../../lib/editorial-auth';
import {editorialEnabled} from '../../../../lib/editorial-config';
import {canonicalSourceId,relationshipEvidence,type PrimaryMetadata} from '@science/sources';
import {metadataCommand} from './actions';
export const dynamic='force-dynamic';
export default async function Metadata({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 if(!editorialEnabled()) return <main><h1>Metadatos primarios</h1><p>Requiere la redacción conectada. Demo sin llamadas externas.</p></main>;
 const {client,role}=await requireMember();const params=await searchParams;
 const item=typeof params.item==='string'&&/^[a-f0-9-]{36}$/i.test(params.item)?params.item:'';
 let identity='';try {if(typeof params.identity==='string') identity=canonicalSourceId(params.identity);} catch {}
 const back='/editorial/metadata?'+new URLSearchParams({...(identity?{identity}:{}),...(item?{item}:{})});
 let snapshotQuery=client.from('metadata_snapshots').select('id,identity,provider,normalized,retrieved_at,payload_hash,adapter_version').order('retrieved_at',{ascending:false}).limit(100);
 if(identity) snapshotQuery=snapshotQuery.eq('identity',identity);
 const results=await Promise.all([
 snapshotQuery,
 client.from('external_review_items').select('id,review_id,extraction,selected_identity,disposition,story_id').eq('disposition','needs_identification').order('imported_at',{ascending:false}).limit(100),
 client.from('pending_resolutions').select('*').order('created_at',{ascending:false}).limit(200),
 client.from('identity_proposals').select('*').order('created_at',{ascending:false}).limit(100),
 client.from('identity_confirmations').select('*').order('created_at',{ascending:false}).limit(200),
 client.from('source_aliases').select('alias,source_id').limit(1000),
 client.from('review_event_observations').select('*').eq('item_id',item||'00000000-0000-0000-0000-000000000000').order('ordinal'),
 client.from('event_reconciliations').select('*').order('created_at',{ascending:false}).limit(200),
 client.from('metadata_fetches').select('identity,status,error_code,fetched_at').order('fetched_at',{ascending:false}).limit(20),
 item?client.from('external_review_items').select('*').eq('id',item).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if(results.some(r=>r.error)) throw new Error('Primary metadata unavailable; local migration 011 is required');
 const [snapshots,pending,resolutions,proposals,confirmations,aliases,observations,reconciliations,fetches,selected]=results.map(r=>r.data) as any[];
 if(identity) {
  const primary=await client.from('metadata_snapshots').select('id,identity,provider,normalized,retrieved_at,payload_hash,adapter_version').eq('provider','arxiv').eq('normalized->>doi',identity).order('retrieved_at',{ascending:false}).limit(20);
  if(primary.error) throw new Error('Related primary metadata unavailable');
  for(const s of primary.data||[]) if(!snapshots.some((x:any)=>x.id===s.id)) snapshots.push(s);
  const dois=[...new Set(snapshots.filter((s:any)=>s.provider==='arxiv'&&s.normalized.doi).map((s:any)=>s.normalized.doi))];
  if(dois.length) {
   const counterpart=await client.from('metadata_snapshots').select('id,identity,provider,normalized,retrieved_at,payload_hash,adapter_version').in('identity',dois).order('retrieved_at',{ascending:false}).limit(20);
   if(counterpart.error) throw new Error('DOI counterpart metadata unavailable');
   for(const s of counterpart.data||[]) if(!snapshots.some((x:any)=>x.id===s.id)) snapshots.push(s);
  }
 }
 const editable=role==='editor';const visible=identity?snapshots.filter((s:any)=>s.identity===identity):snapshots;
 const hidden=<input type="hidden" name="back" value={back}/>;
 const reason=<label>Motivo y comprobación humana <textarea name="reason" required minLength={10} maxLength={2000}/></label>;
 const current=selected;const history=resolutions.filter((r:any)=>r.item_id===item);const latest=history[0];
 const story=latest?.story_id||current?.story_id;
 if(story) {
  const resolvedItems=[...new Set(resolutions.filter((r:any)=>r.story_id===story).map((r:any)=>r.item_id))];
  const related=await client.from('review_event_observations').select('*,external_review_items!inner(story_id)').eq('external_review_items.story_id',story).limit(100);
  const resolved=resolvedItems.length?await client.from('review_event_observations').select('*').in('item_id',resolvedItems).limit(100):{data:[],error:null};
  if(related.error||resolved.error) throw new Error('Related event observations unavailable');
  for(const o of [...(related.data||[]),...(resolved.data||[])]) if(!observations.some((x:any)=>x.id===o.id)) observations.push(o);
 }
 const notices:Record<string,string>={saved:'Decisión guardada.',queued:'Solicitud en cola. Ejecuta el worker local; recarga después.',stale:'La versión ha cambiado; revisa los datos antes de confirmar.',held:'No se guardó: comprueba evidencia, permisos, versión y datos.',conflict:'Conflicto de identidades. Se conservan ambos registros; no se fusionaron.'};
 return <main className="metadata-panel"><h1>Metadatos e identidad científica</h1><nav className="editorial-navigation"><a href="/editorial">Nuevas</a><a href="/editorial/imports">Informes externos</a><a href="/editorial/stories">Catálogo</a></nav>
 <p>Informe externo ≠ metadatos primarios ≠ relación bibliográfica confirmada ≠ verdad científica. Las claims siguen sin verificar.</p>
 {typeof params.notice==='string'&&<p role="status">{notices[params.notice]||''}</p>}
 <form method="get"><label>DOI o arXiv <input name="identity" defaultValue={identity} maxLength={500}/></label>{item&&<input type="hidden" name="item" value={item}/>}<button>Buscar metadatos guardados</button></form>
 {editable&&<form action={metadataCommand}>{hidden}<input type="hidden" name="command" value="fetch"/><label>Solicitar metadatos (sin LLM) <input name="identity" required defaultValue={identity} maxLength={500}/></label><button>Encolar consulta primaria</button></form>}
 <h2>Identificaciones pendientes</h2><p>Últimas 100 secciones; las resueltas conservan el original y su historial.</p><ul>{pending.map((p:any)=><li key={p.id}><a href={'/editorial/metadata?item='+p.id}>{p.extraction.title}</a> · {resolutions.some((r:any)=>r.item_id===p.id)?'resolución guardada':'pendiente'}</li>)}</ul>
 {current&&<section><h2>Declarado en el informe</h2><a href={'/editorial/imports/'+current.review_id}>Markdown original y procedencia</a><pre className="review-text">{JSON.stringify(current.extraction,null,2)}</pre><p>Identidad original: {current.selected_identity||'ninguna'} · {current.disposition} · no se modifica.</p>
 <h3>Historial de resolución</h3><ul>{history.map((r:any)=><li key={r.id}>v{r.version}: {r.source_id} → {r.story_id} · snapshot {r.snapshot_id} · {r.actor} · {r.reason}</li>)}</ul>
 {editable&&current.disposition==='needs_identification'&&<form action={metadataCommand}>{hidden}<input type="hidden" name="command" value="resolve"/><input type="hidden" name="item" value={item}/><input type="hidden" name="expected" value={latest?.version||0}/><input type="hidden" name="commandId" value={randomUUID()}/><label>Identidad propuesta / evidencia primaria <select name="snapshot" required>{snapshots.map((s:any)=><option key={s.id} value={s.id}>{s.identity} · {s.normalized.title} · {s.retrieved_at}</option>)}</select></label>{reason}<button>Confirmar identificación</button></form>}
 </section>}
 <h2>Recuperado del servicio primario</h2><p>Snapshots inmutables. Fecha de recuperación, hash y versión del adapter separados de las fechas de publicación. El API arXiv muestra la versión devuelta, no todo el historial.</p>
 {visible.map((s:any)=><article className="candidate-card" key={s.id}><h3>{s.normalized.title}</h3><p>{s.identity} · {s.provider} · {s.retrieved_at} · {s.adapter_version}</p><p className="review-hash">SHA-256 {s.payload_hash} · snapshot {s.id}</p><pre className="review-text">{JSON.stringify(s.normalized,null,2)}</pre><p>Coincidencia exacta: {aliases.filter((a:any)=>a.alias===s.identity).map((a:any)=>a.source_id).join(', ')||'sin Source existente'}</p></article>)}
 <h2>Propuestas DOI ↔ arXiv</h2><p>Solo una referencia DOI explícita del servicio primario permite proponer una relación. Comparar títulos y autores es una comprobación adicional, nunca prueba suficiente.</p>
 {snapshots.filter((s:any)=>s.provider==='arxiv'&&s.normalized.doi).flatMap((a:any)=>snapshots.filter((d:any)=>d.provider==='crossref'&&d.identity===a.normalized.doi).map((d:any)=>{
 const check=relationshipEvidence(a.normalized as PrimaryMetadata,d.normalized as PrimaryMetadata);const proposal=proposals.find((p:any)=>p.arxiv_snapshot===a.id&&p.doi_snapshot===d.id);
 const left=aliases.find((x:any)=>x.alias===a.identity)?.source_id,right=aliases.find((x:any)=>x.alias===d.identity)?.source_id;const conflict=left&&right&&left!==right;
 return <article className="candidate-card" key={a.id+d.id}><h3>{a.identity} ↔ {d.identity}</h3><p>Evidencia: {a.id} + {d.id}. {check.warnings.join(', ')||'Título y autor compatibles'}</p><p>{conflict?'Conflicto: dos Source distintos. Se requiere revisión manual; ambos se conservan.':'Sin conflicto de Source detectado en esta vista; se comprueba de nuevo al confirmar.'}</p>
 {proposal?<><ul>{confirmations.filter((c:any)=>c.proposal_id===proposal.id).map((c:any)=><li key={c.id}>{c.outcome} · {c.reason} · {c.actor}</li>)}</ul>{editable&&<form action={metadataCommand}>{hidden}<input type="hidden" name="command" value="link"/><input type="hidden" name="proposal" value={proposal.id}/><input type="hidden" name="commandId" value={randomUUID()}/>{reason}<button>Confirmar relación bibliográfica</button></form>}</>:editable&&<form action={metadataCommand}>{hidden}<input type="hidden" name="command" value="propose"/><input type="hidden" name="arxiv" value={a.id}/><input type="hidden" name="doi" value={d.id}/><button>Registrar propuesta para revisión</button></form>}</article>;
 }))}
 {current&&<section><h2>Observaciones de eventos</h2><p>Cada observación conserva su sección y posición. Selecciona solo observaciones del mismo evento; una fecha desconocida no prueba equivalencia. Las conclusiones publicadas no cambian.</p>
 <ul>{observations.map((o:any)=><li key={o.id}><a href={'/editorial/metadata?item='+o.item_id}>Sección {o.item_id}</a> · #{o.ordinal} · {JSON.stringify(o.reported)} · UUID {o.id}<ul>{reconciliations.filter((r:any)=>r.observation_id===o.id).map((r:any)=><li key={r.id}>v{r.version} → {r.event_id} · {r.reason}</li>)}</ul></li>)}</ul>
 {editable&&observations.length>0&&<form action={metadataCommand}>{hidden}<input type="hidden" name="command" value="reconcile"/><input type="hidden" name="commandId" value={randomUUID()}/><input type="hidden" name="expected" value={JSON.stringify(Object.fromEntries(observations.map((o:any)=>[o.id,reconciliations.find((r:any)=>r.observation_id===o.id)?.version||0])))}/>
 {observations.map((o:any)=><label key={o.id}><input type="checkbox" name="observation" value={o.id}/>Sección {o.item_id} · observación #{o.ordinal}</label>)}
 <label>Snapshot <select name="snapshot">{snapshots.map((s:any)=><option key={s.id} value={s.id}>{s.identity} · {s.id}</option>)}</select></label>
 <label>Tipo <select name="kind">{['initial_preprint','preprint_revision','journal_publication','correction','retraction'].map(k=><option key={k}>{k}</option>)}</select></label>
 <label>Base primaria (initialPublished, version, published, published-online, published-print o update:0) <input name="basis" required defaultValue="initialPublished"/></label>{reason}<button>Confirmar vínculo de observaciones</button></form>}</section>}
 <details><summary>Últimas consultas y errores</summary><pre className="review-text">{JSON.stringify(fetches,null,2)}</pre></details>
 </main>;
}
