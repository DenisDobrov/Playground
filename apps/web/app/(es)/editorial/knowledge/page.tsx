import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {knowledgeQuery,knowledgeUrl,knowledgeKinds,contextDecisionState} from '@science/core';
import {requireMember} from '../../../../lib/editorial-auth';
import {editorialEnabled} from '../../../../lib/editorial-config';
import {loadKnowledge,KnowledgeUnavailable} from '../../../../lib/knowledge';
import {KnowledgeCard,KnowledgeBadge,KnowledgeContextStatus,knowledgeLabels} from '../../../../components/knowledge-card';
import {decideKnowledgeContext} from './actions';
import './knowledge.css';

export const dynamic='force-dynamic';
export const metadata={title:'Knowledge Base · Dobrov Academy',robots:{index:false,follow:false}};
const notices:Record<string,string>={saved:'Решение о связи сохранено.',conflict:'Данные изменились. Проверьте обновлённую запись и повторите решение.',invalid:'Не удалось прочитать форму.',failed:'Решение не сохранено. Обновите страницу и повторите.'};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const raw=await searchParams,params=knowledgeQuery(raw);
 if(!editorialEnabled())return <main id="main-content" className="kb-page"><h1>Knowledge Base</h1><p>Приватная база знаний доступна при подключённой редакции. Демонстрационные знания не подставляются.</p></main>;
 const {client,role}=await requireMember();
 let data:Awaited<ReturnType<typeof loadKnowledge>>;
 try{data=await loadKnowledge(client,params);}catch(error){if(!(error instanceof KnowledgeUnavailable))throw error;return <main id="main-content" className="kb-page"><h1>Knowledge Base</h1><p role="status">{error.missingMigration?'Раздел ещё не подключён к этой базе. Требуется отдельно согласованное обновление базы знаний.':'База знаний временно недоступна. Сохранённые записи не изменены.'}</p><Link href="/editorial/news">Вернуться в редакцию</Link></main>;}
 const {search,entry,target,targets,suggestions,decisions,reason}=data;
 const browse=(changes:Parameters<typeof knowledgeUrl>[0])=>knowledgeUrl({...params,...changes})+(changes?.entry?'#knowledge-detail':'');
 const writable=role==='editor'&&target&&entry?.is_current&&entry.entry_key!=='news:'+target.id;
 return <main id="main-content" className="kb-page">
  <nav className="kb-topnav" aria-label="Разделы редакции"><Link href="/editorial/news">← Редакция</Link><Link href="/editorial/news?view=video">Video Ideas</Link><span>Приватно · {role==='editor'?'Редактор':'Только чтение'}</span></nav>
  <header className="kb-header"><div><p className="kb-eyebrow">DOBROV ACADEMY / РЕДАКЦИОННАЯ ПАМЯТЬ</p><h1>Knowledge Base</h1><p>Источники, утверждения и решения — с их основаниями и историей.</p></div><span className="kb-count">{search.total}<small>найдено</small></span></header>
  <nav className="kb-tabs" aria-label="Режим базы знаний"><Link aria-current={params.mode==='library'?'page':undefined} href={browse({mode:'library'})}>Библиотека</Link><Link aria-current={params.mode==='context'?'page':undefined} href={browse({mode:'context'})}>Контекст для новости</Link></nav>
  {typeof raw.notice==='string'&&notices[raw.notice]&&<p className="kb-saved" role="status">{notices[raw.notice]}</p>}
  {params.mode==='context'&&<section className="kb-target"><h2>Новость и её точная версия</h2>
    {target?<><p><strong>{target.content.en.title}</strong> · v{target.version}</p><p>{target.content.es.title}</p><p className="kb-muted">Связь обогащает рабочий контекст. Она не меняет статью, научный статус или решение о публикации.</p><Link href={browse({package:'',target:''})}>Выбрать другую новость</Link></>:<>
      {params.package&&<p className="kb-warning">Эта версия новости больше не актуальна или недоступна. История связей сохранена; выберите текущую версию.</p>}
      <form action="/editorial/knowledge" className="kb-target-search"><input type="hidden" name="mode" value="context"/><input type="hidden" name="entry" value={params.entry}/><label>Поиск новости<input type="search" name="target" maxLength={200} defaultValue={params.target}/></label><button>Найти новость</button></form>
      <ul className="kb-target-list">{targets.map(row=><li key={row.package_id}><Link href={browse({package:row.package_id})}>{row.title} · v{row.revision}</Link></li>)}</ul><p className="kb-muted">До 20 актуальных материалов. Поиск охватывает весь каталог.</p></>}
  </section>}
  {target&&data.linked.length>0&&<details className="kb-target" open><summary>Сохранённый контекст · {data.linked.length>50?'50+':data.linked.length}</summary><ul className="kb-target-list">{data.linked.slice(0,50).map(link=>{const current=data.linkedRecords.find(r=>r.entry_key===link.entry_key)??null;const state=contextDecisionState(link,current,target.id);return <li key={link.id}><Link href={browse({entry:link.entry_key})}>{link.entry_snapshot.title}</Link> · {state==='stale'?'снимок изменился':state==='accept'?'связь принята':'не использовать'}</li>;})}</ul>{data.linked.length>50&&<p className="kb-muted">Показаны последние 50 разных связей. Остальные решения доступны через историю записи в библиотеке.</p>}</details>}
  {target&&<section className="kb-suggestions"><h2>Подобрано автоматически</h2><p className="kb-muted">Бесплатный подбор по общему сюжету, URL источника или тегу. Это правила сопоставления, не научная проверка ИИ.</p><div>{suggestions.map(s=><Link key={s.entry_key} href={browse({entry:s.entry_key})}><strong>{s.title}</strong><small>{s.reason}</small></Link>)}</div>{!suggestions.length&&<p>Совпадений не найдено. Можно выбрать запись через поиск.</p>}</section>}
  <form action="/editorial/knowledge" className="kb-search" role="search"><input type="hidden" name="mode" value={params.mode}/>{params.package&&<input type="hidden" name="package" value={params.package}/>}
    <label className="kb-search-text">Поиск в базе знаний<input name="q" type="search" placeholder="Тема, DOI, утверждение или причина решения…" defaultValue={params.q} maxLength={200}/></label>
    <label>Тип записи<select name="kind" defaultValue={params.kind}><option value="all">Все типы</option>{knowledgeKinds.map(k=><option key={k} value={k}>{knowledgeLabels[k]}</option>)}</select></label>
    <label className="kb-check"><input type="checkbox" name="history" value="1" defaultChecked={params.history}/>Включая старые версии</label><button>Найти</button>
  </form>
  <div className="kb-grid"><section className="kb-library" aria-label="Результаты поиска"><div className="kb-row"><h2>Знания и опыт</h2><small>{search.total} записей</small></div>
    {search.items.map(row=><Link className={'kb-list-item'+(row.entry_key===entry?.entry_key?' selected':'')} key={row.entry_key} aria-current={row.entry_key===entry?.entry_key?'true':undefined} href={browse({entry:row.entry_key,page:search.page})}><div className="kb-row"><span className="kb-eyebrow">{knowledgeLabels[row.kind]}</span><KnowledgeBadge record={row}/></div><h3>{row.title}</h3><p>{row.summary||'Основание и история внутри записи.'}</p></Link>)}
    {!search.items.length&&<p className="kb-empty">По этому запросу записей нет. Попробуйте DOI, название источника или другой тип.</p>}
    <nav className="kb-pagination" aria-label="Страницы результатов">{search.page>1&&<Link href={browse({page:search.page-1,entry:''})}>← Назад</Link>}<span>{search.page} / {search.pages}</span>{search.page<search.pages&&<Link href={browse({page:search.page+1,entry:''})}>Далее →</Link>}</nav>
  </section><section id="knowledge-detail" className="kb-inspector" aria-label="Выбранная запись">
    {entry?<>{target&&<section className="kb-context-review"><h2>Связь с выбранной новостью</h2><div className="kb-rationale"><h3>Автоматическое обоснование</h3><p>{reason||'Совпадение по правилам не найдено. Вы можете связать запись вручную, прочитав её основание.'}</p></div>
      <KnowledgeContextStatus decision={decisions[0]} entry={entry} packageId={target.id}/>
      {writable?<form action={decideKnowledgeContext} key={entry.record_hash+target.id+(decisions[0]?.id??'')}><input type="hidden" name="package" value={target.id}/><input type="hidden" name="entry" value={entry.entry_key}/><input type="hidden" name="hash" value={entry.record_hash}/><input type="hidden" name="previous" value={decisions[0]?.id??''}/><input type="hidden" name="request" value={randomUUID()}/><label>Ваш комментарий <span className="kb-muted">· необязательно</span><textarea name="comment" maxLength={4000} rows={3} defaultValue={decisions[0]?.comment??''}/></label><div className="kb-actions"><button name="decision" value="accept" className="primary">Подтвердить связь</button><button name="decision" value="reject">Не использовать</button></div></form>:<p className="kb-muted">{role!=='editor'?'Доступ только для чтения.':entry.entry_key==='news:'+target.id?'Выберите другую запись: новость не связывается сама с собой.':'Для новой связи нужна актуальная версия записи.'}</p>}
    </section>}<KnowledgeCard record={entry} related={data.related} history={data.history} versions={data.versions} contextPackage={target?.id}/></>:<p className="kb-empty">Выберите запись, чтобы увидеть источники, ограничения и историю.</p>}
  </section></div>
 </main>;
}
