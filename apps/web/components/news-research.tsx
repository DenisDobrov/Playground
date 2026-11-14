import type {NewsPackage} from '@science/core';
export function NewsResearch({research:r}:{research:NonNullable<NewsPackage['research']>}){
 return <details><summary>Досье, проверка источников и редакционный brief</summary>
 <p>Проверка агентом: {r.sourceReview.status}. {r.sourceReview.findings}</p><p>Досье хранит проверки на момент подготовки. Актуальное решение владельца показано в статусе карточки. Независимое научное воспроизведение не выполнялось.</p>
 <h3>Даты события</h3><ul>{r.eventDates.map((d,i)=><li key={i}>{d.kind}: {d.date??'не установлена'} · {d.notes} <a href={d.source}>Источник</a></li>)}</ul>
 <h3>Досье на английском</h3><p lang="en">{r.dossier.summaryEn}</p><ol lang="en">{r.dossier.claims.map(c=><li key={c.id}><strong>{c.id}: {c.textEn}</strong><p>{c.type} · {c.object}. {c.conditions}</p><p>Quantity: {c.quantity??'—'}; unit: {c.unit??'—'}; comparator: {c.comparator??'—'}; sample: {c.sample??'—'}; uncertainty: {c.uncertainty??'—'}.</p><p>{c.limitations}</p><a href={c.source}>{c.locator}</a></li>)}</ol>
 <p lang="en">Author validation: {r.dossier.authorValidation}</p><p lang="en">External verification: {r.dossier.externalVerification}</p>
 <h3>Редакционный brief</h3><dl lang="en">{Object.entries(r.editorialBrief).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
 <h3>Проверка языков агентом</h3><ul>{r.languageChecks.map(c=><li key={c.language}>{c.language}: {c.status} · {c.notes}</li>)}</ul>
 {r.videoBrief&&<section><h3>Suggested for Video · только редакционная идея</h3><dl lang="en">{(['angle','audience','keyMessage','importance','autonomyLimits'] as const).map(k=><div key={k}><dt>{k}</dt><dd>{r.videoBrief![k]}</dd></div>)}</dl><p>Утверждения досье: {r.videoBrief.claimIds.join(', ')}</p><ul>{r.videoBrief.visuals.map((v,i)=><li key={i}><a href={v.url}>{v.description}</a><p>{v.rights}</p></li>)}</ul><ul>{r.videoBrief.questions.map(q=><li key={q}>{q}</li>)}</ul><p>Сценарий, TTS, кадры и производство не запускались.</p></section>}
 </details>;
}
