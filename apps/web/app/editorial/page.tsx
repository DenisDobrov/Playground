import { demoBundle } from '@science/core/demo';
import { publicationIssues, stageNames } from '@science/core';
import { Studio } from './studio';

export default function Editorial() {
  return <main><div className="editorial-heading"><div><p className="eyebrow">WORKSPACE / SHADOW MODE</p><h1>La redacción.</h1><p>Un expediente. Una historia. Múltiples formatos.</p></div><span className="status-pill">● DEMO SIN CONEXIÓN</span></div>
    <section className="stats"><div><span>Idioma editorial</span><strong>ES <small>neutro</small></strong></div><div><span>Selección semanal</span><strong>10–20 <small>historias</small></strong></div><div><span>Balance temático</span><strong>70 / 30 <small>IA / física</small></strong></div><div><span>Vídeo objetivo</span><strong>2–3 <small>por semana</small></strong></div></section>
    <Studio bundle={demoBundle} stages={[...stageNames]} issues={publicationIssues(demoBundle)} />
  </main>;
}
