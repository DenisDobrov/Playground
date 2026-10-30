'use client';
import {useActionState} from 'react';
import {previewReview,confirmReview,type ImportState} from './actions';
const flags:Record<string,string>={future_scope:'Tema futuro',missing_primary_source:'Falta una publicación primaria',multiple_publications_choose_identity:'Varias publicaciones: elige una identidad',date_requires_review:'Fecha parcial o no reconocida',incomplete_fields:'Faltan campos',unparsed_section:'Formato no reconocido: revisión manual'};
export function ImportForm() {
  const [state,previewAction,previewPending]=useActionState<ImportState,FormData>(previewReview,{});
  const [saved,confirmAction,confirmPending]=useActionState<ImportState,FormData>(confirmReview,{});
  return <>
    <form action={previewAction} className="intake-form intake-panel">
      <label>Origen<select name="sourceType"><option value="chatgpt">Informe de ChatGPT</option><option value="external_review">Otro informe externo</option></select></label>
      <label>Markdown<textarea name="markdown" rows={10} placeholder="# 1. Fundamental physics: …" /></label>
      <label>O archivo Markdown · máximo 256 KiB<input type="file" name="file" accept=".md,.markdown,text/markdown" /></label>
      <button type="submit" disabled={previewPending}>{previewPending ? 'Preparando…' : 'Preparar vista previa'}</button>
      <p>La vista previa no guarda historias. No se consultan enlaces ni se llama a un modelo.</p>
    </form>
    {state.error && <p role="alert">{state.error}</p>}
    {saved.error && <p role="alert">{saved.error}</p>}
    {state.preview && <form action={confirmAction}>
      <input type="hidden" name="document" value={JSON.stringify(state.markdown)} /><input type="hidden" name="sourceType" value={state.sourceType} />
      <h2>Vista previa · {state.preview.total} secciones</h2>
      <p>Nuevas: {state.preview.newCandidates} · coincidencias: {state.preview.matches} · posibles duplicados: {state.preview.potentialDuplicates} · temas futuros: {state.preview.unsupported} · sin fuente primaria: {state.preview.missingPrimary} · revisión manual: {state.preview.manual}</p>
      <p>Los contadores pueden solaparse. Fechas, prioridad y explicaciones proceden del informe y siguen sin verificar. No se fusionan publicaciones por título o tema.</p>
      {state.preview.items.map(({candidate:c,matches,defaultIdentity,duplicateInReview})=><article className="candidate-card" key={state.hash+':'+c.key}>
        <label><input type="checkbox" name="selected" value={c.key} /> Importar esta sección</label>
        <h3>{c.title}</h3><p>{c.category} · líneas {c.startLine}–{c.endLine} · unverified</p>
        {!!c.flags.length && <p>{c.flags.map(f=>flags[f]||f).join(' · ')}</p>}{duplicateInReview && <p>Esta publicación aparece también en otra sección del informe.</p>}
        {matches.map(m=><p key={m.identity+':'+m.storyId}>Coincidencia exacta: {m.title} · {m.status} · {m.identity}</p>)}
        <label>Publicación de referencia<select name={'identity:'+c.key} defaultValue={defaultIdentity}>
          <option value="">Guardar solo para identificación manual</option>
          {[...new Set(c.references.filter(r=>r.role==='primary_candidate').map(r=>r.canonicalId))].map(identity=><option key={identity} value={identity}>{identity}</option>)}
        </select></label>
        {!c.domain && <p>Se guardará en el archivo de temas futuros, sin crear una historia en la cola activa.</p>}
        {matches.length>0 && <label><input type="checkbox" name={'reopen:'+c.key} /> Solicitar revisión si hay un evento nuevo. Las publicaciones existentes permanecen intactas.</label>}
        <details><summary>Resumen, límites, fechas y referencias</summary>
          <h4>Qué cambió</h4><pre className="review-text">{c.summary||'No extraído'}</pre><h4>Importancia</h4><pre className="review-text">{c.significance||'No extraída'}</pre>
          <h4>Límites / Hype check</h4><pre className="review-text">{c.limitations||'No extraídos'}</pre><p>Prioridad propuesta: {c.priority||'No indicada'}</p>
          <ul>{c.events.map((e,i)=><li key={i}>{e.kind} · {e.reportedDate||'fecha no indicada'} · {e.revision ? 'v'+e.revision : ''}</li>)}</ul>
          <ul>{c.references.map((r,i)=><li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.canonicalId}</a> · {r.role} · {r.revision ? 'v'+r.revision : ''}</li>)}</ul>
          <p>Preguntas pendientes: {c.questions||'No extraídas; comprobar fuentes primarias.'}</p>
        </details>
      </article>)}
      <button type="submit" disabled={confirmPending}>{confirmPending ? 'Guardando…' : 'Confirmar selección'}</button>
    </form>}
  </>;
}
