import {randomUUID} from 'node:crypto';
import {requireMember} from '../../../../lib/editorial-auth';
import {NewsCard,type NewsCardData,type NewsDelivery,type NewsPublication} from '../../../../components/news-card';
import {catalogSelection,type NewsCatalogEntry} from '../../../../lib/news-catalog';
import {signOut} from '../../login/actions';
export const dynamic='force-dynamic';
const notices:Record<string,string>={saved:'Решение, комментарий и предложения сохранены.',conflict:'Пакет изменился. Проверьте актуальную версию и примите решение заново.',invalid:'Не удалось прочитать решение.',failed:'Решение не сохранено. Повторите после обновления страницы.'};
export default async function Page({searchParams}:{searchParams:Promise<{view?:string;notice?:string;q?:string;page?:string}>}) {
  const params=await searchParams;const {notice}=params;const {client,role}=await requireMember();
  // Read only compact private metadata for filtering; load immutable full packages for this page.
  const entries:NewsCatalogEntry[]=[];
  for(let offset=0;;offset+=200){
    if(offset>=5000)throw new Error('Newsroom catalog requires a larger server-side search index');
    const chunk=await client.from('news_state').select('story_id,package_id,decision,suggested_video,suggested_science,package:news_packages!news_state_package_id_fkey(en_title:content->en->>title,es_title:content->es->>title,slug:content->>slug)').order('updated_at',{ascending:false}).order('story_id').range(offset,offset+199).overrideTypes<NewsCatalogEntry[],{merge:false}>();
    if(chunk.error)throw new Error('Newsroom unavailable');entries.push(...chunk.data);if(chunk.data.length<200)break;
  }
  const selection=catalogSelection(entries,params),{view}=selection;
  const result=selection.items.length?await client.from('news_state').select('story_id,package_id,version,decision,comment,suggested_video,suggested_science,flags_origin,package:news_packages!news_state_package_id_fkey(id,version,content)').in('package_id',selection.items.map(r=>r.package_id)).overrideTypes<NewsCardData[],{merge:false}>():{data:[],error:null};
  if(result.error)throw new Error('Newsroom unavailable');
  const rows=(result.data||[]).sort((a,b)=>selection.items.findIndex(r=>r.package_id===a.package_id)-selection.items.findIndex(r=>r.package_id===b.package_id));
  const deliveries=rows.length?await client.from('news_outbox').select('id,package_id,channel,state,remote_url,error_code').in('package_id',rows.map(r=>r.package_id)).limit(1000):{data:[],error:null};
  if(deliveries.error)throw new Error('Delivery status unavailable');
  const publications=rows.length?await client.from('news_releases').select('package_id,story_id,language,slug,published_at').in('story_id',rows.map(r=>r.story_id)).limit(1000):{data:[],error:null};
  if(publications.error||publications.data?.length===1000)throw new Error('Publication history unavailable');
  const pageUrl=(page:number)=>'/editorial/news?'+new URLSearchParams({view:view??'new',q:selection.query,page:String(page)}).toString();
  return <main id="main-content" className="news-reading"><div className="editorial-heading"><h1>{view==='video'?'Video Ideas / Ideas para vídeo':'Редакция новостей'}</h1><form action={signOut}><button>Выйти</button></form></div><p>Одно решение на готовые версии EN/ES и тексты для каналов. {role==='reviewer'?'Доступ только для чтения.':''}</p>
    <nav className="editorial-navigation" aria-label="Разделы редакции"><a href="/editorial/news" aria-current={view==='new'?'page':undefined}>Новые</a><a href="/editorial/news?view=all" aria-current={view==='all'?'page':undefined}>Все новости</a><a className="video-ideas-tab" href="/editorial/news?view=video" aria-current={view==='video'?'page':undefined}>Video Ideas <span className="tab-count">{selection.videoCount}</span></a><a href="/editorial/news?view=science" aria-current={view==='science'?'page':undefined}>Идеи исследований</a><a href="/editorial/stories">Архив источников</a><a href="/editorial/intake">Добавить источник</a></nav>
    {view==='video'&&<p>Приватный список идей: опубликованные новости и черновики с вашим флагом. Обоснование ИИ отделено от комментария владельца. Производство видео остаётся на паузе.</p>}
    <form className="publication-search" action="/editorial/news" role="search"><input type="hidden" name="view" value={view}/><label htmlFor="private-news-query">Поиск по названию EN / ES</label><div><input id="private-news-query" type="search" name="q" defaultValue={selection.query} maxLength={200}/><button>Найти</button></div></form><p>{selection.count} записей</p>
    {notice&&notices[notice]&&<p role="status">{notices[notice]}</p>}
    {!rows.length&&<p>В этом списке пока нет новостей.</p>}
    {rows.map(row=><NewsCard key={`${row.package_id}:${row.version}`} row={row} requestId={randomUUID()} editor={role==='editor'} compact={view==='video'} publications={((publications.data||[]) as NewsPublication[]).filter(r=>r.story_id===row.story_id)} deliveries={(deliveries.data||[] as NewsDelivery[]).filter(d=>d.package_id===row.package_id)}/>)}
    {selection.pages>1&&<nav className="pagination" aria-label="Страницы">{selection.page>1&&<a href={pageUrl(selection.page-1)}>← Назад</a>}<span>{selection.page} / {selection.pages}</span>{selection.page<selection.pages&&<a href={pageUrl(selection.page+1)}>Далее →</a>}</nav>}
  </main>;
}
