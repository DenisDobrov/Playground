import {randomUUID} from 'node:crypto';
import {requireMember} from '../../../../lib/editorial-auth';
import {editorialEnabled} from '../../../../lib/editorial-config';
import {reviewContent} from './actions';
export const dynamic='force-dynamic';
export default async function Content({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 if(!editorialEnabled())return <main><h1>Borradores científicos ES/EN y guion</h1><p>Requiere redacción conectada. No se generan borradores en demo.</p></main>;
 const {client}=await requireMember(),params=await searchParams;
 const list=await client.from('content_drafts').select('id,kind,story_id,created_at').order('created_at',{ascending:false}).limit(100);
 if(list.error)throw new Error('Content drafts unavailable; local migration 013 required');
 const briefs=await client.from('editorial_briefs').select('id,dossier_id,preliminary,created_at').eq('preliminary',false).order('created_at',{ascending:false}).limit(30);
 let draft:any=null,receipt:any=null,reviews:any[]=[],input:any=null,current=false;
 if(params.draft&&/^[a-f0-9-]{36}$/i.test(params.draft)) {
  const r=await client.from('content_drafts').select('*').eq('id',params.draft).single();if(r.error)throw new Error('Draft unavailable');draft=r.data;
  const rr=await Promise.all([client.from('content_receipts').select('*').eq('id',draft.receipt_id).single(),client.from('content_reviews').select('*').eq('draft_id',draft.id).order('version',{ascending:false}),client.rpc('content_generation_input',{p_brief:draft.brief_id})]);
  if(rr[0].error||rr[1].error)throw new Error('Draft provenance unavailable');receipt=rr[0].data;reviews=rr[1].data||[];input=receipt.input_snapshot;current=!rr[2].error&&rr[2].data?.inputHash===draft.input_hash;
 }
 const messages:Record<string,string>={saved:'Revisión guardada para esta versión exacta. Sin publicación.',stale:'El evidence package o la revisión cambió. Recarga antes de decidir.',blocked:'No guardado: revisa permisos, flags, checks y motivo.'};
 return <main className="metadata-panel"><h1>Borradores científicos ES/EN y guion</h1><nav className="editorial-navigation"><a href="/editorial">Redacción</a><a href="/editorial/research">Investigación</a><a href="/editorial/content">Contenido</a></nav>
 <p>Cada idioma y guion requiere su propia revisión. Citas extraídas y bibliografía confirmada no equivalen a verificación científica independiente. No se publica desde esta pantalla.</p>
 {params.notice&&<p role="status">{messages[params.notice]}</p>}
 <h2>Briefs revisados</h2><p>La disponibilidad se vuelve a comprobar al generar. La generación se ejecuta en el worker con precios y reserva de presupuesto.</p><ul>{briefs.data?.map(b=><li key={b.id}>Brief {b.id} · <a href={'/editorial/research?dossier='+b.dossier_id}>Dossier</a></li>)}</ul>
 <h2>Revisiones inmutables</h2><ul>{list.data?.map(d=><li key={d.id}><a href={'?draft='+d.id}>{d.kind} · {d.id}</a> · {d.created_at}</li>)}</ul>
 {draft&&<section><h2>{draft.payload.title}</h2><p>{draft.kind} · {current?'Evidence package vigente':'OBSOLETO: requiere inputs y revisión actuales'}</p><p className="review-hash">Output SHA-256: {draft.output_hash}<br/>Input SHA-256: {draft.input_hash}</p><p>{draft.payload.aiDisclosure}</p>
 {draft.payload.sections?.map((s:any)=><section key={s.key}><h3>{s.key.replaceAll('_',' ')}</h3>{s.paragraphs.map((p:any,i:number)=><div key={i}><p>{p.text}</p><small>Claims: {p.claimIds.join(', ')||'SIN MAPEO'} · Caveats: {p.caveatIds.join(', ')}</small></div>)}</section>)}
 {draft.payload.scenes?.map((s:any)=><section key={s.id}><h3>{s.id} · {s.type} · ~{s.durationEstimateSeconds}s</h3><p>{s.narrationEs}</p><p>Visual propuesto: {s.visualDescription} · {s.explanatoryLabelEs}</p><small>Claims: {s.sourceClaimIds.join(', ')} · Caveats: {s.caveatIds.join(', ')}</small></section>)}
 {draft.kind==='script_es'&&<p>Duración estimada por texto: no es audio TTS medido. Assets, derechos, voz y revisión audiovisual siguen pendientes.</p>}
 <h3>Flags de alineación</h3><ul>{draft.issues.map((s:string)=><li key={s}>{s}</li>)}</ul><p>Una lista vacía solo acredita comprobaciones estructurales. Inspecciona significado, cifras, unidades y traducción de cada párrafo/escena.</p>
 <h3>Claims aprobadas y evidencia localizada</h3>{input.brief.approvedFindings.map((f:any)=><article className="candidate-card" key={f.claimId}><h4>{f.text}</h4><p>Claim {f.claimId} · review {f.reviewId}</p>{input.evidence.filter((e:any)=>f.evidenceIds.includes(e.id)).map((e:any)=><blockquote key={e.id}>{e.quote}<br/>{e.locator} · {e.numericalResults}</blockquote>)}</article>)}
 <h3>Caveats obligatorias</h3><ul>{input.brief.mandatoryCaveats.map((s:string,i:number)=><li key={i}>caveat-{i}: {s}</li>)}</ul>
 <h3>Fuentes originales</h3><ul>{input.brief.sourceReferences.map((s:any)=><li key={s.sourceId}><a href={s.url}>{s.url}</a> · {s.version}</li>)}</ul>
 <details><summary>Modelo, prompt, presupuesto y procedencia exacta</summary><pre className="review-text">{JSON.stringify({audit:receipt.audit,operationId:receipt.operation_id,providerReceipt:receipt.response.receipt,usage:receipt.response.usage,durationMs:receipt.response.durationMs,responseHash:receipt.response_hash,document:input.document,reviewIds:input.reviewIds,approvalId:input.approvalId},null,2)}</pre></details>
 <h3>Revisiones humanas</h3><ul>{reviews.map(r=><li key={r.id}>v{r.version} · {r.decision} · {r.reason} · {r.reviewer_id} · {r.created_at}</li>)}</ul>
 {current&&<form action={reviewContent}><input type="hidden" name="draft" value={draft.id}/><input type="hidden" name="hash" value={draft.output_hash}/><input type="hidden" name="inputHash" value={draft.input_hash}/><input type="hidden" name="expected" value={reviews[0]?.version||0}/><input type="hidden" name="commandId" value={randomUUID()}/>
 <label>Decisión<select name="decision"><option value="request_revision">Solicitar nueva revisión</option><option value="approve">Aprobar esta revisión exacta</option><option value="reject">Rechazar</option></select></label>
 {([['claimAlignment','He comprobado cada claim y su evidencia.'],['languageQuality','He revisado idioma, claridad y significado científico.'],['scientificCaveats','Se conservan todas las limitaciones y el alcance.'],['quantitativeValues','Se conservan cifras, unidades y cuantificadores.']] as const).map(([key,label])=><label key={key}><input type="checkbox" name={key}/>{label}</label>)}
 <label>Motivo<textarea required name="reason" minLength={10} maxLength={3000}/></label><button>Guardar revisión humana</button><p>La aprobación de texto no autoriza publicación ni aprueba MP4, voz, imágenes o derechos.</p></form>}
 </section>}
 </main>;
}
