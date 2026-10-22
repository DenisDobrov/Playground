import { requireMember } from '../../../../lib/editorial-auth';
import { editorialEnabled } from '../../../../lib/editorial-config';
export const dynamic = 'force-dynamic';
const usd = (micros: number | string) => new Intl.NumberFormat('es',{style:'currency',currency:'USD',maximumFractionDigits:6}).format(Number(micros)/1_000_000);
const labels: Record<string,string> = {news_analysis:'Análisis de noticias',content:'Texto y guion',voice:'Voz',video:'Vídeo'};
export default async function Budget({searchParams}: {searchParams:Promise<{month?:string}>}) {
  if(!editorialEnabled()) return <main><h1>Presupuesto de producción</h1><p>Activa la redacción conectada para consultar el ledger real. La demo no gasta dinero.</p><a href="/editorial">Volver</a></main>;
  const {client}=await requireMember();
  const requested=(await searchParams).month;
  const month=(typeof requested==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) && Number(requested.slice(0,4))>0 ? requested : new Date().toISOString().slice(0,7))+'-01';
  const {data:summary,error}=await client.from('budget_summary').select('*').eq('month',month).maybeSingle();
  const unavailable=error && ['PGRST205','42P01'].includes(error.code);
  if(error && !unavailable) throw new Error('Production budget is unavailable');
  const {data:categories,error:categoryError}=summary ? await client.from('budget_category_summary').select('*').eq('month',month) : {data:null,error:null};
  const {data:operations,error:operationsError}=summary ? await client.from('budget_operations').select('id,category,tool,state,estimate_micros,actual_micros,created_at').eq('month',month).order('created_at',{ascending:false}).limit(15) : {data:null,error:null};
  if(categoryError || operationsError) throw new Error('Production budget details are unavailable');
  return <main><p className="eyebrow">REDACCIÓN / PRODUCCIÓN</p><h1>Presupuesto de producción.</h1>
    <nav className="editorial-navigation"><a href="/editorial">Nuevas</a><a href="/editorial/stories">Todas las historias</a><a href="/editorial/budget" aria-current="page">Presupuesto</a></nav>
    <p>USD · mes UTC {month.slice(0,7)} · solo lectura. Incluye análisis, texto, voz y vídeo. No incluye suscripciones de infraestructura ni trabajo editorial.</p>
    <form action="/editorial/budget" className="intake-form"><label>Mes<input name="month" type="month" defaultValue={month.slice(0,7)} required /></label><button type="submit">Consultar</button></form>
    {!summary ? <p>{unavailable ? 'Esta base requiere la migración 008.' : 'No hay un presupuesto configurado para este mes. Las operaciones con coste quedan bloqueadas.'}</p> : <>
      <section className="stats"><div><span>Límite mensual</span><strong>{usd(summary.limit_micros)}</strong></div><div><span>Contabilizado</span><strong>{usd(summary.spent_micros)}</strong></div><div><span>Reservado</span><strong>{usd(summary.reserved_micros)}</strong></div><div><span>Disponible</span><strong>{usd(Math.max(0,Number(summary.limit_micros)-Number(summary.spent_micros)-Number(summary.reserved_micros)))}</strong></div></section>
      {(Number(summary.unresolved_count)>0 || Number(summary.overrun_count)>0) && <p className="editorial-notice" role="status">Pendientes de conciliación: {summary.unresolved_count}. Operaciones por encima de la reserva: {summary.overrun_count}. Comprobar el recibo antes de repetir.</p>}
      <p>Límite por historia/mes: {usd(summary.story_limit_micros)} · por vídeo/mes: {usd(summary.video_limit_micros)}. Una factura superior a la estimación se registra completa y reduce el saldo disponible.</p>
      <div className="budget-table"><table><caption>Distribución mensual</caption><thead><tr><th>Herramientas</th><th>Límite</th><th>Contabilizado</th><th>Reservado</th></tr></thead><tbody>{categories?.map(c=><tr key={c.category}><th>{labels[c.category]}</th><td>{usd(c.limit_micros)}</td><td>{usd(c.spent_micros)}</td><td>{usd(c.reserved_micros)}</td></tr>)}</tbody></table></div>
      <h2>Últimas operaciones</h2><p>Los ensayos y las herramientas locales se identifican en la columna de herramienta. Un importe cero no significa que exista audio o vídeo generado.</p>
      <div className="budget-table"><table><thead><tr><th>Área / herramienta</th><th>Estado</th><th>Reserva</th><th>Contabilizado</th></tr></thead><tbody>{operations?.map(o=><tr key={o.id}><th>{labels[o.category]}<br/><small>{o.tool}</small></th><td>{o.state}</td><td>{usd(o.estimate_micros)}</td><td>{o.actual_micros===null ? '—' : usd(o.actual_micros)}</td></tr>)}</tbody></table></div>
    </>}
  </main>;
}
