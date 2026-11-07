import Link from 'next/link';
import {notFound} from 'next/navigation';
import {digestPath,methodPath,newsPath,newsReleases,newsArticleJsonLd,serializeJsonLd} from '../lib/news';
import {NewsBody} from './news-body';
import {PublicPageAnalytics} from './public-page-analytics';

export async function NewsArticle({language,slug}:{language:'en'|'es';slug:string}) {
  const release = (await newsReleases()).find(r=>r.language===language&&r.slug===slug);
  if (!release) notFound();
  const en=language==='en'; const {article,sources}=release.content;
  return <main className="news-reading"><p className="eyebrow">{article.type==='analysis'?(en?'ANALYSIS':'ANÁLISIS'):(en?'RESEARCH NEWS':'ACTUALIDAD CIENTÍFICA')}</p>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(newsArticleJsonLd(release))}}/>
    <PublicPageAnalytics path={newsPath(language,slug)}/>
    <h1>{article.title}</h1><p><Link href={methodPath(language)}>{en?'By Dobrov Academy':'Por Dobrov Academy'}</Link> · <time dateTime={release.first_published_at}>{en?'Published':'Publicado'}: {new Date(release.first_published_at??release.published_at).toLocaleDateString(en?'en-GB':'es',{timeZone:'UTC',dateStyle:'long'})}</time> · <Link href={newsPath(en?'es':'en',slug)} hrefLang={en?'es':'en'}>{en?'Leer en español':'Read in English'}</Link></p>
    {release.modified_at!==release.first_published_at&&<p><time dateTime={release.modified_at}>{en?'Updated':'Actualizado'}: {new Date(release.modified_at??release.published_at).toLocaleDateString(en?'en-GB':'es',{timeZone:'UTC',dateStyle:'long'})}</time></p>}
    {article.sourcePublicationMonth&&<p>{en?'Research journal issue':'Número de la revista científica'}: <time dateTime={article.sourcePublicationMonth}>{new Date(article.sourcePublicationMonth+'-01T00:00:00Z').toLocaleDateString(en?'en-GB':'es',{month:'long',year:'numeric',timeZone:'UTC'})}</time>.</p>}
    <NewsBody article={article} language={language}/>
    <aside className="news-limit"><h2>{en?'What this does not establish':'Lo que esto no demuestra'}</h2><p>{article.limitations}</p></aside>
    <h2>{en?'Original sources and dates':'Fuentes originales y fechas'}</h2>
    <ol>{sources.map(s=><li key={s.url}><a href={s.url} rel="noopener noreferrer">{s.title}</a><p>{s.kind} · {en?'Access':'Acceso'}: {s.access==='full_text'?(en?'relevant full-text sections':'secciones pertinentes del texto completo'):s.access==='abstract'?(en?'abstract only':'solo resumen'):s.access==='metadata_only'?(en?'bibliographic reference only':'solo referencia bibliográfica'):(en?'announcement':'comunicado')}. {en?'Study':'Estudio'}: {s.studyDate||'—'}; {en?'announcement':'anuncio'}: {s.announcementDate||'—'}.</p>{s.related?.map(r=><p key={r.url}><a href={r.url}>{r.label}</a></p>)}</li>)}</ol>
    <p className="news-method">{en?'Source-checked news summary with AI-assisted translation and owner release authorization. This is not independent scientific replication or peer review.':'Resumen contrastado con las fuentes, con traducción asistida por IA y autorización editorial del propietario. No equivale a una replicación científica independiente ni a una revisión por pares.'}</p>
    <Link href={release.content.period.startsWith('standalone:')?(en?'/en':'/'):digestPath(language)}>{en?'More science news →':'Más noticias científicas →'}</Link>
  </main>;
}
export async function NewsDigest({language,home=false}:{language:'en'|'es';home?:boolean}) {
  const rows=(await newsReleases()).filter(r=>r.language===language&&(home||r.content.period==='2026-11-01/2026-11-07')).sort((a,b)=>home?(b.first_published_at??b.published_at).localeCompare(a.first_published_at??a.published_at):a.content.section-b.content.section);
  const en=language==='en';
  if(!rows.length&&!home)notFound();
  return <main className="news-reading"><p className="eyebrow">DOBROV ACADEMY · 1–7 NOV 2026</p><h1>{home?(en?'Science, with its limits in view.':'Ciencia, con sus límites a la vista.'):(en?'The week in science · 1–7 November 2026':'La semana en ciencia · 1–7 noviembre 2026')}</h1>
    {!!rows.length&&<PublicPageAnalytics path={home?(en?'/en':'/'):digestPath(language)}/>}
    <p>{home?(en?'Research news in English and Spanish. Explore the latest edition, with original sources and the limits of each finding.':'Noticias científicas en español e inglés. Explora el último número, con fuentes originales y los límites de cada resultado.'):(en?'Our weekly review: primary sources, clear explanations, and a distinction between findings and promises.':'Nuestro repaso semanal: fuentes originales, explicaciones claras y una distinción entre resultados y promesas.')}</p>
    <p><Link href={home?(en?'/':'/en'):digestPath(en?'es':'en')} hrefLang={en?'es':'en'}>{en?'Versión en español':'English edition'}</Link></p>
    {home&&!!rows.length&&<p><Link href={digestPath(language)}>{en?'Read the complete weekly review →':'Leer el repaso semanal completo →'}</Link></p>}
    {!rows.length&&<p>{en?'The first release is being prepared. No research news has been published yet.':'Estamos preparando el primer número. Todavía no hay noticias científicas publicadas.'}</p>}
    {rows.map(r=><article key={r.id} className="news-digest-item"><p className="eyebrow">{String(r.content.section).padStart(2,'0')}</p><h2><Link href={newsPath(language,r.slug)}>{r.content.article.title}</Link></h2>{!home&&<><p>{r.content.article.paragraphs[0]}</p><p className="news-caveat">{r.content.article.limitations}</p></>}<Link href={newsPath(language,r.slug)}>{en?'Read with sources →':'Leer con fuentes →'}</Link></article>)}
    {!!rows.length&&<p><a href="https://whatsapp.com/channel/0029VbDqlX2JP21B9kIR2m0U" rel="noopener noreferrer">{en?'Follow Dobrov Academy on WhatsApp →':'Sigue a Dobrov Academy en WhatsApp →'}</a></p>}
    {!!rows.length&&<p className="news-method">{en?'Only source-checked, authorized stories appear here. Original numbering is retained; gaps indicate items held for further checking. Research news is not medical advice.':'Solo aparecen noticias contrastadas y autorizadas. Conservamos la numeración original; los huecos corresponden a temas pendientes de comprobación. Las noticias de investigación no son recomendaciones médicas.'}</p>}
  </main>;
}
