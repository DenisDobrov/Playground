import { notFound } from 'next/navigation';
import { demoBundle } from '@science/core/demo';

export function generateStaticParams() { return [{ slug: demoBundle.story.slug }]; }
export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== demoBundle.story.slug) notFound();
  const { article, dossier, script } = demoBundle;
  return <main className="article-layout"><article><p className="eyebrow">EXPEDIENTE DEMO / INTELIGENCIA ARTIFICIAL</p><h1>{article.title}</h1><p className="notice">{article.aiDisclosureEs}</p>
    {article.paragraphs.map((p, i) => <p className="article-paragraph" key={i}>{p.textEs} <a className="claim-link" href="#evidence">[{i + 1}]</a></p>)}
    <h2>Lo que este ejemplo no demuestra</h2><p>No representa una investigación real ni una evaluación independiente. Sirve para explorar el formato del portal.</p>
    <h2>El vídeo, escena a escena</h2>{script.scenes.map((s, i) => <div className="scene" key={s.id}><span className="scene-number">0{i + 1}</span><div><strong>{s.narrationEs}</strong><p>{s.visualDescription}</p><small>{s.durationSeconds} s · {s.visual} · {s.claimIds.join(', ')}</small></div></div>)}
  </article><aside className="evidence-panel" id="evidence"><p className="eyebrow">EVIDENCIA ABIERTA</p><h2>Del texto a la fuente</h2>{dossier.claims.map(c => <div className="evidence-item" key={c.id}><span className="tag">{c.evidenceLevel} · SIN VERIFICAR</span><p>{c.textEn}</p><small>Tipo: {c.type}</small><p className="muted">{c.caveatEn}</p></div>)}{dossier.evidence.map(e => <blockquote key={e.id}>{e.quote}<cite>{e.locator} · fuente ficticia example.org</cite></blockquote>)}<p className="notice">Publicación bloqueada hasta completar revisión científica, lingüística y editorial.</p></aside></main>;
}
