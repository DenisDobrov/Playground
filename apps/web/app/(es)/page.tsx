import Link from 'next/link';
import { demoBundle } from '@science/core/demo';

export default function Home() {
  return <main>
    <section className="intro"><p className="eyebrow">01 / UNA VENTANA A LA CIENCIA</p><h1>Entender lo nuevo.<br/><em>Sin perder la perspectiva.</em></h1><p className="intro-copy">Inteligencia artificial, física y espacio. Lo que sabemos, cómo lo sabemos y lo que todavía está por demostrar.</p></section>
    <div className="section-heading"><h2>Dentro de la redacción</h2><span>VISTA PREVIA · EDICIÓN 001</span></div>
    <section className="lead-grid">
      <Link className="lead-story" href={`/historias/${demoBundle.story.slug}`}>
        <div className="science-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="core"/><span>OBSERVAR / MEDIR / INTERPRETAR</span></div>
        <div className="story-copy"><p className="eyebrow">INTELIGENCIA ARTIFICIAL <span className="tag">A1 · EJEMPLO</span></p><h2>{demoBundle.article.title}</h2><p>El protocolo, las comparaciones y los límites importan tanto como la puntuación.</p><span className="text-link">Explorar el expediente →</span></div>
      </Link>
      <aside className="method-card"><p className="eyebrow">NO SOLO EL TITULAR</p><h2>Una noticia.<br/>Todas sus capas.</h2><ol><li><strong>El resultado</strong><span>Qué se observó realmente.</span></li><li><strong>La evidencia</strong><span>Fuente, método y límites.</span></li><li><strong>El contexto</strong><span>Qué cambia y qué sigue abierto.</span></li><li><strong>La explicación</strong><span>Artículo y vídeo desde el mismo expediente.</span></li></ol><Link href="/politica">Conoce nuestro método ↗</Link></aside>
    </section>
    <section className="bottom-grid"><div><p className="eyebrow">02 / VÍDEO DESDE EL PRIMER DÍA</p><h2>La ciencia también<br/>se puede ver.</h2><p>Voz en español, imágenes científicas y diagramas explicativos. Cada escena vinculada a sus fuentes.</p><Link className="button" href="/editorial">Abrir estudio editorial →</Link></div><div className="video-frame"><span className="play-mark" aria-hidden="true">▷</span><strong>Del hallazgo a la explicación</strong><span>Guion → visuales → voz → revisión</span><small>Storyboard de demostración · vídeo aún no renderizado</small></div></section>
  </main>;
}
