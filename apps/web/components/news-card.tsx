'use client';
import {useState} from 'react';
import type {NewsPackage} from '@science/core';
import {decideNews} from '../app/(es)/editorial/news/actions';
import {NewsBody} from './news-body';
import {newsPath} from '../lib/news-seo';
import {topicOf,topics} from '../lib/news-presentation';
export interface NewsCardData {story_id:string;package_id:string;version:number;decision:string|null;comment:string;suggested_video:boolean;suggested_science:boolean;flags_origin:string;package:{id:string;version:number;content:NewsPackage};}
export interface NewsDelivery {id:string;package_id:string;channel:string;state:string;remote_url:string|null;error_code:string|null;}
export interface NewsPublication {package_id:string;story_id:string;language:'en'|'es';slug:string;published_at:string;}
export function NewsCard({row,requestId,editor,deliveries,publications=[],compact=false}:{row:NewsCardData;requestId:string;editor:boolean;deliveries:NewsDelivery[];publications?:NewsPublication[];compact?:boolean}) {
  const [language,setLanguage]=useState<'en'|'es'>('es'); const p=row.package.content;const article=p[language];
  const labels:Record<string,string>={pending:'Ожидает',sending:'Отправляется',published:'Опубликовано',blocked:'Нужен доступ',failed:'Ошибка',uncertain:'Нужна проверка результата',cancelled:'Отменено'};
  const delivered=deliveries.filter(d=>d.state==='published').length;
  const recommendation=p.suggestions.videoRecommendation?.[language],rationale=recommendation?.reason||p.suggestions.videoReason;
  const review=<div className="news-editor-card"><p className="eyebrow">{p.period.startsWith('standalone:')?'Анализ':`№${p.section}`} · {p.period} · {row.decision==='approve'?'Разрешён выпуск':row.decision==='reject'?'Отклонено':'Ожидает решения'}</p>
    <div role="group" aria-label="Язык новости"><button type="button" aria-pressed={language==='es'} onClick={()=>setLanguage('es')}>ES</button><button type="button" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button></div>
    <section lang={language}><h2>{article.title}</h2><NewsBody article={article} language={language}/><aside className="news-limit">{article.limitations}</aside></section>
    <p>{p.verification.status==='checked_summary'?'Пересказ сверен с источниками.':'Выпуск заблокирован: '+p.verification.reason} Независимое научное воспроизведение не выполнялось.</p>
    <p role="status">{publications.some(r=>r.package_id===row.package_id)?'Текущий пакет опубликован на сайте.':publications.length?'На сайте опубликована предыдущая версия; текущий пакет — черновик.':'На сайте ещё не опубликовано.'} {deliveries.length>0&&<>Каналы: {delivered} из {deliveries.length} опубликовано{deliveries.some(d=>['failed','uncertain'].includes(d.state))?' · требуется проверка':''}.</>}</p>
    {!compact&&rationale&&<aside className="news-ai-recommendation"><h3>AI recommendation / Recomendación de IA</h3><p lang={recommendation?language:undefined}>{rationale}</p>{recommendation&&<><p>{recommendation.visualAngle}</p><p>{recommendation.caveat}</p></>}<small>ИИ · {p.suggestions.videoRecommendation?.version??'news-release/1'} · пакет v{row.package.version}. Это предложение, не ваш комментарий.</small></aside>}
    <details><summary>Источники и изменения</summary><ul>{p.sources.map(s=><li key={s.url}><a href={s.url}>{s.title}</a> · {s.access} · {s.studyDate||'дата исследования не установлена'} / {s.announcementDate||'без отдельного анонса'}<p>{s.finding}</p></li>)}</ul>{p.changes.map((c,i)=><p key={i}>{c.original} → {c.replacement}. {c.reason} <a href={c.source}>Источник</a></p>)}</details>
    {p.campaign&&<section aria-label="Статичная кампания"><h3>{p.campaign.title}</h3><p>Новая версия кампании требует нового решения ниже. Предыдущее разрешение не переносится. Изображение и канальные тексты входят в этот пакет.</p>{p.campaign.assets.filter(a=>a.language===language).map(a=><figure key={a.sha256}><img src={a.dataUrl} alt={a.alt} width={a.width} height={a.height} style={{width:'100%',maxWidth:432,height:'auto'}}/><figcaption>Оригинальная типографическая карточка Dobrov Academy · {a.language.toUpperCase()} · SHA256 {a.sha256}</figcaption></figure>)}</section>}
    <details><summary>Версии для каналов</summary>{Object.entries(p.channelTexts).map(([channel,text])=><section key={channel}><h3>{channel}</h3><p lang="en" style={{whiteSpace:'pre-wrap'}}>{text.en}</p><p lang="es" style={{whiteSpace:'pre-wrap'}}>{text.es}</p></section>)}</details>
    <form action={decideNews}><input type="hidden" name="package" value={row.package_id}/><input type="hidden" name="version" value={row.version}/><input type="hidden" name="request" value={requestId}/>
      <fieldset disabled={!editor}><label>Комментарий <span>(необязательно)</span><textarea name="comment" maxLength={4000} defaultValue={row.comment}/></label>
        <label><input type="checkbox" name="video" defaultChecked={row.suggested_video}/> Suggested for Video</label>
        <label><input type="checkbox" name="science" defaultChecked={row.suggested_science}/> Suggested for Science Publication</label>
        <p>Только идеи для будущего. Производство видео и научных рукописей заморожено.</p>
        <div className="news-decisions"><button name="decision" value="approve" disabled={p.verification.status!=='checked_summary'}>Подтвердить и опубликовать</button><button name="decision" value="reject">Отвергнуть</button></div>
      </fieldset>
    </form>
    <details><summary>Доставка и история</summary><p>Пакет {row.package_id}, версия {row.package.version}; предложения: {row.flags_origin}.</p><p>{p.suggestions.videoReason} {p.suggestions.scienceReason}</p>{row.decision==='reject'&&deliveries.some(d=>d.state==='published')&&<p>Опубликованные материалы остаются доступными. Для снятия или исправления нужна отдельная операция.</p>}<ul>{deliveries.map(d=><li key={d.id}>{d.channel}: {d.error_code==='OWNER_DEFERRED'?'Отложено владельцем':labels[d.state]||d.state} {d.remote_url&&<a href={d.remote_url}>Открыть публикацию</a>} {d.error_code&&<small>{d.error_code}</small>}</li>)}</ul><a href={`/editorial/news/history?story=${row.story_id}`}>История решений</a></details>
  </div>;
  if(!compact)return <article>{review}</article>;
  const links=(['es','en'] as const).map(lang=>publications.filter(r=>r.language===lang).sort((a,b)=>b.published_at.localeCompare(a.published_at))[0]).filter(Boolean);
  return <article className="news-idea-card"><p className="eyebrow">{topics[topicOf(p.en,p.slug)][language]} · {p.sources[0]?.studyDate||p.period} · {row.decision==='approve'?'Разрешён':row.decision==='reject'?'Отклонён':'Ожидает решения'}</p><h2>{article.title}</h2><p>{publications.some(r=>r.package_id===row.package_id)?'Текущий пакет опубликован':publications.length?'Опубликована прежняя версия; текущий пакет — черновик':'Черновик'} · {links.map(r=><a key={r.language} href={newsPath(r.language,r.slug)}>{r.language.toUpperCase()} ↗ </a>)}</p><aside className="news-ai-recommendation"><h3>AI recommendation / Recomendación de IA</h3><p>{rationale||'Для этой версии обоснование пока не сформировано.'}</p>{recommendation&&<><p>{recommendation.visualAngle}</p><p>{recommendation.caveat}</p></>}<small>ИИ · {p.suggestions.videoRecommendation?.version??'news-release/1'} · пакет v{row.package.version}. Производство видео на паузе.</small></aside><p><a href={p.sources[0]?.url}>{p.sources[0]?.title}</a></p><details><summary>Открыть новость и редакционное решение</summary>{review}</details></article>;
}
