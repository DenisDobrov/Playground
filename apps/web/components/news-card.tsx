'use client';
import {useState} from 'react';
import type {NewsPackage} from '@science/core';
import {decideNews} from '../app/(es)/editorial/news/actions';
export interface NewsCardData {story_id:string;package_id:string;version:number;decision:string|null;comment:string;suggested_video:boolean;suggested_science:boolean;flags_origin:string;package:{id:string;version:number;content:NewsPackage};}
export interface NewsDelivery {id:string;package_id:string;channel:string;state:string;remote_url:string|null;error_code:string|null;}
export function NewsCard({row,requestId,editor,deliveries}:{row:NewsCardData;requestId:string;editor:boolean;deliveries:NewsDelivery[]}) {
  const [language,setLanguage]=useState<'en'|'es'>('es'); const p=row.package.content;const article=p[language];
  const labels:Record<string,string>={pending:'Ожидает',sending:'Отправляется',published:'Опубликовано',blocked:'Нужен доступ',failed:'Ошибка',uncertain:'Нужна проверка результата',cancelled:'Отменено'};
  const delivered=deliveries.filter(d=>d.state==='published').length;
  return <article className="news-editor-card"><p className="eyebrow">№{p.section} · {p.period} · {row.decision==='approve'?'Разрешён выпуск':row.decision==='reject'?'Отклонено':'Ожидает решения'}</p>
    <div role="group" aria-label="Язык новости"><button type="button" aria-pressed={language==='es'} onClick={()=>setLanguage('es')}>ES</button><button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button></div>
    <section lang={language}><h2>{article.title}</h2>{article.paragraphs.map((text,i)=><p key={i}>{text}</p>)}<aside className="news-limit">{article.limitations}</aside></section>
    <p>{p.verification.status==='checked_summary'?'Пересказ сверен с источниками.':'Выпуск заблокирован: '+p.verification.reason} Независимое научное воспроизведение не выполнялось.</p>
    {deliveries.length>0&&<p role="status">Сайт: опубликовано EN/ES. Каналы: {delivered} из {deliveries.length} опубликовано{deliveries.some(d=>d.state==='blocked')?' · нужен доступ':''}{deliveries.some(d=>['failed','uncertain'].includes(d.state))?' · требуется проверка':''}. {row.decision==='reject'?'Отказ отменяет оставшиеся отправки; уже опубликованные страницы и посты сохраняются до отдельной коррекции.':''}</p>}
    <details><summary>Источники и изменения</summary><ul>{p.sources.map(s=><li key={s.url}><a href={s.url}>{s.title}</a> · {s.access} · {s.studyDate||'дата исследования не установлена'} / {s.announcementDate||'без отдельного анонса'}<p>{s.finding}</p></li>)}</ul>{p.changes.map((c,i)=><p key={i}>{c.original} → {c.replacement}. {c.reason} <a href={c.source}>Источник</a></p>)}</details>
    <details><summary>Версии для каналов</summary>{Object.entries(p.channelTexts).map(([channel,text])=><section key={channel}><h3>{channel}</h3><p lang="en">{text.en}</p><p lang="es">{text.es}</p></section>)}</details>
    <form action={decideNews}><input type="hidden" name="package" value={row.package_id}/><input type="hidden" name="version" value={row.version}/><input type="hidden" name="request" value={requestId}/>
      <fieldset disabled={!editor}><label>Комментарий <span>(необязательно)</span><textarea name="comment" maxLength={4000} defaultValue={row.comment}/></label>
        <label><input type="checkbox" name="video" defaultChecked={row.suggested_video}/> Suggested for Video</label>
        <label><input type="checkbox" name="science" defaultChecked={row.suggested_science}/> Suggested for Science Publication</label>
        <p>Только идеи для будущего. Производство видео и научных рукописей заморожено.</p>
        <div className="news-decisions"><button name="decision" value="approve" disabled={p.verification.status!=='checked_summary'}>Подтвердить и опубликовать</button><button name="decision" value="reject">Отвергнуть</button></div>
      </fieldset>
    </form>
    <details><summary>Доставка и история</summary><p>Пакет {row.package_id}, версия {row.package.version}; предложения: {row.flags_origin}.</p><p>{p.suggestions.videoReason} {p.suggestions.scienceReason}</p>{row.decision==='reject'&&deliveries.some(d=>d.state==='published')&&<p>Опубликованные материалы остаются доступными. Для снятия или исправления нужна отдельная операция.</p>}<ul>{deliveries.map(d=><li key={d.id}>{d.channel}: {labels[d.state]||d.state} {d.remote_url&&<a href={d.remote_url}>Открыть публикацию</a>} {d.error_code&&<small>{d.error_code}</small>}</li>)}</ul><a href={`/editorial/news/history?story=${row.story_id}`}>История решений</a></details>
  </article>;
}
