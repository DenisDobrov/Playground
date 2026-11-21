import Link from 'next/link';
import {knowledgeUrl,knowledgeSourceUrl,contextDecisionState,type KnowledgeRecord,type KnowledgeDecision} from '@science/core';
import {newsPath} from '../lib/news-seo';
import {languages,type Language} from '../lib/news-languages';

export const knowledgeLabels={topic:'Тема',source:'Источник',claim:'Утверждение',decision:'Решение',material:'Материал'};
const statuses:Record<string,string>={pending:'Ожидает решения',approve:'Выпуск разрешён',reject:'Отклонено',historical:'Историческая версия',metadata:'Метаданные',catalogued:'В каталоге',research:'Исследовательское досье',unverified:'Не верифицировано',verified:'Исходный статус: verified',narrowed:'Формулировка ограничена',rejected:'Отклонено',checked:'Проверено агентом',limited:'Ограниченная проверка',blocked:'Проверка заблокирована',abstract:'Доступна аннотация',full_text:'Доступен полный текст',announcement:'Анонс',metadata_only:'Только метаданные',select:'Выбрано',hold:'Отложено',revise:'Повторное рассмотрение',accept:'Смысл принят'};
const origins:Record<string,string>={news_package:'Неизменяемый пакет новости',news_source_observation:'Источник в конкретной версии новости',agent_news_dossier:'Утверждение из агентского досье',canonical_source:'Канонический источник',concept:'Понятие из глоссария',article_tag:'Тег существующих статей',research_dossier:'Исследовательское досье',research_claim:'Утверждение из исследовательского досье',editorial_decision:'Решение редактора',news_decision:'Решение о выпуске новости'};
export function KnowledgeBadge({record}:{record:KnowledgeRecord}){return <span className="kb-badge">{!record.is_current?'Историческая версия':statuses[record.payload.status]??record.payload.status}</span>;}
export function KnowledgeEvidence({record}:{record:KnowledgeRecord}){
 const sources=record.payload.sources??[];
 return <><dl className="kb-fields">{Object.entries(record.payload.fields??{}).filter(([,value])=>value!==null&&value!=='').map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
 {sources.length?sources.map((source,index)=>{const href=knowledgeSourceUrl(source.url);return <section className="kb-source" key={index}>
   <h3>{href?<a href={href} target="_blank" rel="noreferrer">{source.title||href} ↗</a>:source.title||'Источник'}</h3>
   {source.finding&&<p>{source.finding}</p>}{source.quote?<blockquote>{source.quote}</blockquote>:record.kind==='claim'&&<p className="kb-muted">Точная цитата в этой записи не сохранена. Locator не заменяет проверки смысла.</p>}
   {source.locator&&<p>Место в документе: {source.locator}</p>}{source.limitations&&<p>{source.limitations}</p>}
   {(source.studyDate||source.announcementDate||source.checkedAt)&&<dl className="kb-fields"><div><dt>Исходная работа</dt><dd>{source.studyDate||'Не установлено'}</dd></div><div><dt>Анонс</dt><dd>{source.announcementDate||'Не указан'}</dd></div><div><dt>Дата проверки источника</dt><dd>{source.checkedAt||'Не указана'}</dd></div></dl>}
 </section>}):<p className="kb-muted">Отдельные источники к этой записи не привязаны.</p>}</>;
}
export function KnowledgeHistory({history,versions=[]}:{history:KnowledgeDecision[];versions?:KnowledgeRecord[]}){
 return <>{versions.length>0&&<section><h3>Сохранённые версии материалов</h3><ul>{versions.slice(0,20).map(row=><li key={row.entry_key}><Link href={knowledgeUrl({entry:row.entry_key,history:true})}>{row.title} · v{row.payload.revision??'—'}</Link> · {row.created_at} {!row.is_current&&'· историческая'}</li>)}</ul></section>}
 {history.length>0?<ol className="kb-history">{history.slice(0,20).map(event=><li key={event.id}><strong>{event.decision==='accept'?'Связь принята':'Связь отклонена'}</strong><p>{event.comment||'Без комментария владельца'}</p><small>{event.created_at} · автор {event.actor_id}</small><p><Link href={knowledgeUrl({mode:'context',package:event.package_id,entry:event.entry_key})}>Целевая версия новости</Link></p><details><summary>Основание и точный снимок</summary><p>{event.rationale} · {event.algorithm}</p><p>{event.entry_snapshot.title}</p><p>{event.entry_snapshot.summary}</p><p>{event.entry_snapshot.payload.limitations}</p><KnowledgeEvidence record={event.entry_snapshot}/><p className="kb-hash">Снимок: {event.record_hash}</p></details></li>)}</ol>:<p className="kb-muted">Решений о повторном использовании этой записи пока нет.</p>}
 {(history.length>20||versions.length>20)&&<p className="kb-muted">Показаны последние 20 записей каждого списка. Более ранние записи сохранены в истории базы.</p>}</>;
}
export function KnowledgeCard({record,related=[],history=[],versions=[],contextPackage}:{record:KnowledgeRecord;related?:KnowledgeRecord[];history?:KnowledgeDecision[];versions?:KnowledgeRecord[];contextPackage?:string}){
 const payload=record.payload;
 return <article className="kb-detail" aria-label="Карточка знания"><div className="kb-row"><span className="kb-eyebrow">{knowledgeLabels[record.kind]}</span><KnowledgeBadge record={record}/></div><h2>{record.title}</h2><p className="kb-muted">{origins[payload.origin]??payload.origin}{payload.revision&&` · v${payload.revision}`}</p>
   <p className="kb-summary">{record.summary||'Описание не сохранено.'}</p>
   {record.kind==='decision'&&<p className="kb-warning">Редакционный мотив не является научным доказательством.</p>}
   {payload.limitations&&<aside className="kb-warning">{payload.limitations}</aside>}
   {payload.independentVerification&&<p className="kb-muted">Независимое воспроизведение: {payload.independentVerification==='not_performed'?'не выполнялось':payload.independentVerification==='not_recorded'?'не зафиксировано':payload.independentVerification}.</p>}
   {(payload.related?.length??0)>0&&<section><h3>Связанные записи</h3><div className="kb-related">{payload.related!.slice(0,12).map((key,index)=><Link key={key} href={knowledgeUrl({entry:key,history:true})}>{related.find(r=>r.entry_key===key)?.title??`Связанный материал ${index+1}`} →</Link>)}</div>{payload.related!.length>12&&<p className="kb-muted">Показаны первые 12 связей из {payload.related!.length}. Все записи доступны в поиске.</p>}</section>}
   <details open><summary>Основание и источники</summary><KnowledgeEvidence record={record}/></details>
   <details><summary>История и версии</summary><KnowledgeHistory history={history} versions={versions}/></details>
   {(payload.publications?.length??0)>0&&<section><h3>Публикации этой версии</h3>{payload.publications!.filter(p=>languages.includes(p.language as Language)).map(p=><p key={p.language}><Link href={newsPath(p.language as Language,p.slug)}>{p.language.toUpperCase()} ↗</Link> · {p.publishedAt}</p>)}</section>}
   <p className="kb-hash">ID: {record.entry_key}</p>
   {record.is_current?<Link className="kb-button primary" href={knowledgeUrl({mode:'context',entry:record.entry_key,package:contextPackage})}>В контекст новости →</Link>:<p className="kb-warning">Историческую запись можно читать. Для новой связи выберите актуальную версию.</p>}
 </article>;
}
export function KnowledgeContextStatus({decision,entry,packageId}:{decision:KnowledgeDecision|undefined;entry:KnowledgeRecord;packageId:string}){
 if(!decision)return null;
 const status=contextDecisionState(decision,entry,packageId);
 return <p className={status==='stale'?'kb-warning':'kb-saved'}>{status==='stale'?'Сохранённая связь относится к прежнему снимку. Нужна повторная проверка.':status==='accept'?'Связь с этой версией сохранена.':'Предложение отклонено.'} {decision.created_at}</p>;
}
