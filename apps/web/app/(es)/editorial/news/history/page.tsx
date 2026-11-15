import {z} from 'zod';
import {requireMember} from '../../../../../lib/editorial-auth';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{story?:string}>}) {
  const {client}=await requireMember();const id=z.uuid().safeParse((await searchParams).story);if(!id.success)notFound();
  const packages=await client.from('news_packages').select('id').eq('story_id',id.data).limit(100);
  if(packages.error)throw new Error('History unavailable');
  const history=await client.from('news_decisions').select('id,package_id,decision,comment,suggested_video,suggested_science,origin,actor_id,created_at').in('package_id',(packages.data||[]).map(p=>p.id)).order('created_at',{ascending:false}).limit(100);
  if(history.error)throw new Error('History unavailable');
  const media=await client.from('news_metadata_events').select('id,kind,origin,actor_id,created_at,before_value,after_value,instruction_hash').eq('story_id',id.data).order('created_at',{ascending:false}).limit(100);
  if(media.error)throw new Error('Metadata history unavailable');
  return <main className="news-reading"><h1>История решений</h1><a href="/editorial/news?view=all">Все новости</a>{history.data?.map(d=><section key={d.id}><h2>{d.decision}</h2><p>{d.comment||'Без комментария'}</p><p>{d.created_at} · {d.origin} · {d.actor_id}</p><p>Video: {String(d.suggested_video)} · Science Publication: {String(d.suggested_science)}</p><small>{d.package_id}</small></section>)}<h2>Видео и редакционные метаданные</h2>{media.data?.map(e=><section key={e.id}><h3>{e.kind==='youtube_link'?'Ссылка YouTube':'Кандидат для видео'}</h3><p>{e.created_at} · {e.origin} · {e.actor_id}</p><p>Было: {JSON.stringify(e.before_value)}</p><p>Стало: {JSON.stringify(e.after_value)}</p>{e.instruction_hash&&<small>Исходное указание владельца: {e.instruction_hash}</small>}</section>)}</main>;
}
