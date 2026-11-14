import {selectText as tr,homePath,languageLocale,type Language} from '../lib/news-languages';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {digestPath,methodPath,newsPath,newsReleases,newsArticleJsonLd,serializeJsonLd,resolveNewsRelease} from '../lib/news';
import {PublicPageAnalytics} from './public-page-analytics';
import {NewsBody} from './news-body';
import {NewsVideo} from './news-video';
import {TopicStrip,PublicNewsCard,NewsDate} from './news-listing';
import {topicOf,topics,topicPath,publicListingPath,readingMinutes,orderedNews} from '../lib/news-presentation';
import {languages,languageNames} from '../lib/news-languages';
import {ArticleLanguages} from './article-languages';
import {NewsTimeline} from './news-timeline';

export async function NewsArticle({language:requested,slug}:{language:Language;slug:string}) {
  const releases=await newsReleases();
  const release=resolveNewsRelease(releases,requested,slug);
  if (!release) notFound();
  const language=release.language,all=orderedNews(releases,language);
  const en=language==='en'; const {article,sources}=release.content;
  const topic=topicOf(article,slug),related=all.filter(r=>r.story_id!==release.story_id&&topicOf(r.content.article,r.slug)===topic).slice(0,3);
  const crumbs=[{name:tr(language,"Inicio","Home","Главная","首页"),url:homePath(language)},{name:topics[topic][language],url:topicPath(language,topic)},{name:article.title,url:newsPath(language,release.slug)}];
  return <main id="main-content" className="publication-article" lang={language}>{requested!==language&&<p className="news-limit" lang={requested}>{tr(requested,'La traducción solicitada aún no está publicada. Mostramos la versión disponible:','The requested translation has not been published. Showing the available version:','Запрошенный перевод ещё не опубликован. Показана доступная версия:','所选译文尚未发布，现显示已有版本：')} {languageNames[language]}.</p>}<TopicStrip rows={all} language={language}/><nav className="breadcrumbs" aria-label={tr(language,"Ruta de navegación","Breadcrumb","Навигационная цепочка","导航路径")}>{crumbs.map((c,i)=><span key={c.url}>{i>0&&<span aria-hidden="true"> / </span>}{i===2?<span aria-current="page">{tr(language,"Artículo","Article","Статья","文章")}</span>:<Link href={c.url}>{c.name}</Link>}</span>)}</nav>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(newsArticleJsonLd(release))}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:'https://dobrov.org'+c.url}))})}}/>
    {requested===language&&slug===release.slug&&<PublicPageAnalytics path={newsPath(language,release.slug)}/>}
    <header className="publication-article-header"><p className="publication-category"><Link href={topicPath(language,topic)}>{topics[topic][language]}</Link><span>{article.type==='analysis'?(tr(language,"Análisis","Analysis","Аналитика","分析")):(tr(language,"Noticias de investigación","Research news","Новости исследований","研究新闻"))}</span></p><h1>{article.title}</h1><p className="publication-meta"><Link href={methodPath(language)}>{tr(language,"Por Dobrov Academy","By Dobrov Academy","Редакция Dobrov Academy","Dobrov Academy 编辑部")}</Link> · {tr(language,"Publicado","Published","Опубликовано","发布日期")}: <NewsDate release={release}/> · {readingMinutes(article)} min</p><ArticleLanguages available={release.availableLanguages??[language]} current={language} slug={release.slug} paths={release.languagePaths}/>
    {release.modified_at!==release.first_published_at&&<p><time dateTime={release.modified_at}>{tr(language,"Actualizado","Updated","Обновлено","更新日期")}: {new Date(release.modified_at??release.published_at).toLocaleDateString(languageLocale[language],{timeZone:'UTC',dateStyle:'long'})}</time></p>}
    {article.sourcePublicationMonth&&<p>{tr(language,"Número de la revista científica","Research journal issue","Выпуск научного журнала","期刊卷期")}: <time dateTime={article.sourcePublicationMonth}>{new Date(article.sourcePublicationMonth+'-01T00:00:00Z').toLocaleDateString(languageLocale[language],{month:'long',year:'numeric',timeZone:'UTC'})}</time>.</p>}
    </header><div className="publication-article-body"><NewsBody article={article} language={language}/>
    <aside className="news-limit"><h2>{tr(language,"Lo que esto no demuestra","What this does not establish","Чего результат не доказывает","这一结果不能证明什么")}</h2><p>{article.limitations}</p></aside>
    <NewsVideo release={release}/>
    {release.content.eventDates&&<NewsTimeline dates={release.content.eventDates} language={language}/>}
    <h2>{tr(language,"Fuentes originales y fechas","Original sources and dates","Первоисточники и даты","原始来源与日期")}</h2>
    <ol>{sources.map(s=><li key={s.url}><a href={s.url} rel="noopener noreferrer">{s.title}</a><p>{({journal:tr(language,'Artículo científico','Journal article','Журнальная статья','期刊论文'),preprint:tr(language,'Preprint','Preprint','Препринт','预印本'),institution:tr(language,'Institución','Institution','Научная организация','研究机构'),vendor:tr(language,'Desarrollador','Developer','Разработчик','开发者'),coverage:tr(language,'Cobertura','Coverage','Освещение','报道')}[s.kind])} · {tr(language,"Acceso","Access","Доступ","访问范围")}: {s.access==='full_text'?(tr(language,"secciones pertinentes del texto completo","relevant full-text sections","проверенные разделы полного текста","已核对的全文相关部分")):s.access==='abstract'?(tr(language,"solo resumen","abstract only","только аннотация","仅摘要")):s.access==='metadata_only'?(tr(language,"solo referencia bibliográfica","bibliographic reference only","только библиографическая запись","仅书目信息")):(tr(language,"comunicado","announcement","сообщение","公告"))}. {tr(language,"Estudio","Study","Исследование","研究")}: {s.studyDate||'—'}; {tr(language,"anuncio","announcement","сообщение","公告")}: {s.announcementDate||'—'}.</p>{s.related?.map(r=><p key={r.url}><a href={r.url}>{r.label}</a></p>)}</li>)}</ol>
    <p className="news-method">{tr(language,"Resumen contrastado con las fuentes, con traducción asistida por IA y autorización editorial del propietario. No equivale a una replicación científica independiente ni a una revisión por pares.","Source-checked news summary with AI-assisted translation and owner release authorization. This is not independent scientific replication or peer review.","Новостной материал сопоставлен с источниками; подготовка и перевод выполнены с помощью ИИ, публикация разрешена владельцем. Это не независимое воспроизведение исследования и не рецензирование.","报道已与来源核对，撰写和翻译由人工智能辅助，并经负责人授权发布。这不等于独立科学复现或同行评审。")}</p>
    <nav className="article-sharing" aria-label={tr(language,"Compartir artículo","Share article","Поделиться статьёй","分享文章")}><a href={`https://t.me/share/url?${new URLSearchParams({url:'https://dobrov.org'+newsPath(language,release.slug),text:article.title})}`}>Telegram</a><a href={`https://twitter.com/intent/tweet?${new URLSearchParams({url:'https://dobrov.org'+newsPath(language,release.slug),text:article.title})}`}>X</a><a href={`mailto:?${new URLSearchParams({subject:article.title,body:'https://dobrov.org'+newsPath(language,release.slug)})}`}>{tr(language,"Correo","Email","Почта","邮件")}</a></nav><Link href={release.content.period.startsWith('standalone:')?publicListingPath(language,'news'):digestPath(language,release.content.period.slice(0,10))}>{tr(language,"Más noticias científicas →","More science news →","Другие новости науки →","更多科学新闻 →")}</Link></div>
    {related.length>0&&<section className="publication-related"><h2>{tr(language,"Lecturas relacionadas","Related reading","Читайте также","相关阅读")}</h2><div className="publication-results">{related.map(r=><PublicNewsCard key={r.id} release={r}/>)}</div></section>}
  </main>;
}
export async function NewsDigest({language,home=false,start='2026-11-01'}:{language:Language;home?:boolean;start?:string}) {
 const rows=(await newsReleases()).filter(r=>r.language===language&&(home||r.content.period.startsWith(start+'/'))).sort((a,b)=>a.content.section-b.content.section);
 if(!rows.length&&!home)notFound();
 const period=rows[0]?.content.period??start;
 return <main id="main-content" className="news-reading"><p className="eyebrow">DOBROV ACADEMY · {period}</p><h1>{tr(language,'La semana en ciencia','The week in science','Неделя в науке','科学周报')}</h1>
 <p>{tr(language,'Fuentes originales, resultados y límites. Solo se muestran las versiones publicadas en este idioma.','Original sources, findings and limits. Only versions published in this language are shown.','Первоисточники, результаты и ограничения. Показаны только опубликованные версии на этом языке.','原始来源、研究结果与局限。仅显示已用本语言发布的版本。')}</p>
 {!!rows.length&&<PublicPageAnalytics path={home?homePath(language):digestPath(language,start)}/>}
 {rows.map(r=><article key={r.id} className="news-digest-item"><p className="eyebrow">{String(r.content.section).padStart(2,'0')}</p><h2><Link href={newsPath(language,r.slug)}>{r.content.article.title}</Link></h2><p>{r.content.article.paragraphs[0]}</p><p className="news-caveat">{r.content.article.limitations}</p><Link href={newsPath(language,r.slug)}>{tr(language,'Leer con fuentes →','Read with sources →','Читать с источниками →','阅读报道与来源 →')}</Link></article>)}
 </main>;
}
