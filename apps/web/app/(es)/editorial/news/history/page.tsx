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
  return <main className="news-reading"><h1>История решений</h1><a href="/editorial/news?view=all">Все новости</a>{history.data?.map(d=><section key={d.id}><h2>{d.decision}</h2><p>{d.comment||'Без комментария'}</p><p>{d.created_at} · {d.origin} · {d.actor_id}</p><p>Video: {String(d.suggested_video)} · Science Publication: {String(d.suggested_science)}</p><small>{d.package_id}</small></section>)}</main>;
}
