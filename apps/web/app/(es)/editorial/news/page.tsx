import {randomUUID} from 'node:crypto';
import {requireMember} from '../../../../lib/editorial-auth';
import {NewsCard,type NewsCardData,type NewsDelivery} from '../../../../components/news-card';
import {signOut} from '../../login/actions';
export const dynamic='force-dynamic';
const notices:Record<string,string>={saved:'Решение, комментарий и предложения сохранены.',conflict:'Пакет изменился. Проверьте актуальную версию и примите решение заново.',invalid:'Не удалось прочитать решение.',failed:'Решение не сохранено. Повторите после обновления страницы.'};
export default async function Page({searchParams}:{searchParams:Promise<{view?:string;notice?:string}>}) {
  const {view,notice}=await searchParams;const {client,role}=await requireMember();
  let query=client.from('news_state').select('story_id,package_id,version,decision,comment,suggested_video,suggested_science,flags_origin,package:news_packages!news_state_package_id_fkey(id,version,content)').order('updated_at',{ascending:false}).limit(100);
  if(view==='video')query=query.eq('suggested_video',true);else if(view==='science')query=query.eq('suggested_science',true);else if(view!=='all')query=query.is('decision',null);
  const result=await query.overrideTypes<NewsCardData[],{merge:false}>();
  if(result.error)throw new Error('Newsroom unavailable');
  const rows=result.data||[];
  const deliveries=rows.length?await client.from('news_outbox').select('id,package_id,channel,state,remote_url,error_code').in('package_id',rows.map(r=>r.package_id)).limit(1000):{data:[],error:null};
  if(deliveries.error)throw new Error('Delivery status unavailable');
  return <main className="news-reading"><div className="editorial-heading"><h1>Редакция новостей</h1><form action={signOut}><button>Выйти</button></form></div><p>Одно решение на готовые версии EN/ES и тексты для каналов. {role==='reviewer'?'Доступ только для чтения.':''}</p>
    <nav className="editorial-navigation"><a href="/editorial/news">Новые</a><a href="/editorial/news?view=all">Все новости</a><a href="/editorial/news?view=video">Идеи видео</a><a href="/editorial/news?view=science">Идеи исследований</a><a href="/editorial/stories">Архив источников</a><a href="/editorial/intake">Добавить источник</a></nav>
    {notice&&notices[notice]&&<p role="status">{notices[notice]}</p>}
    {!rows.length&&<p>В этом списке пока нет новостей.</p>}
    {rows.map(row=><NewsCard key={`${row.package_id}:${row.version}`} row={row} requestId={randomUUID()} editor={role==='editor'} deliveries={(deliveries.data||[] as NewsDelivery[]).filter(d=>d.package_id===row.package_id)}/>)}
  </main>;
}
