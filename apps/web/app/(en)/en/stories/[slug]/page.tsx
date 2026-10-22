import Link from 'next/link';
import { notFound } from 'next/navigation';
import { demoBundle } from '@science/core/demo';
import { englishDemo } from '../../../../../lib/english-demo';
export function generateStaticParams() { return [{ slug: englishDemo.slug }]; }
export default async function EnglishStory({ params }: { params: Promise<{ slug: string }> }) {
  if ((await params).slug !== englishDemo.slug) notFound();
  return <main className="article-layout"><article><p className="eyebrow">DEMONSTRATION DOSSIER / ARTIFICIAL INTELLIGENCE</p><h1>{englishDemo.title}</h1><p className="notice">{englishDemo.disclosure}</p><Link href={`/historias/${demoBundle.story.slug}`} hrefLang="es">Leer en español →</Link>
    {englishDemo.paragraphs.map((p,i) => <p className="article-paragraph" key={i}>{p.text} <a className="claim-link" href="#evidence">[{i+1}]</a></p>)}
    <h2>What this example does not establish</h2><p>This is neither real research nor an independent evaluation. It demonstrates the format of the portal.</p>
    <h2>From article to video</h2><p>The Spanish video pilot will use a separately reviewed script based on an approved article and dossier revision. No finished video is available for this demonstration.</p>
  </article><aside className="evidence-panel" id="evidence"><p className="eyebrow">OPEN EVIDENCE</p><h2>From text to source</h2>{demoBundle.dossier.claims.map(c => <div className="evidence-item" key={c.id}><span className="tag">{c.evidenceLevel} · UNVERIFIED</span><p>{c.textEn}</p><small>Type: {c.type}</small><p className="muted">{c.caveatEn}</p></div>)}{demoBundle.dossier.evidence.map(e => <blockquote key={e.id}>{e.quote}<cite>{e.locator} · fictional source example.org</cite></blockquote>)}<p className="notice">Publication is blocked pending scientific, language and editorial review.</p></aside></main>;
}
