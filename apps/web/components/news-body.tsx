import type {NewsPackage} from '@science/core';
import './news-body.css';
/** Escaped text and semantic tables only. Source material cannot provide HTML. */
export function NewsBody({article,language='es'}:{article:NewsPackage['en'];language?:'en'|'es'}) {
  if(!article.blocks)return <>{article.paragraphs.map((text,i)=><p key={i}>{text}</p>)}</>;
  return <>{article.blocks.map((block,i)=>block.type==='heading'?<h2 key={i}>{block.text}</h2>:block.type==='paragraph'?<p key={i}>{block.text}</p>:<figure className="news-table" key={i}>
    <div role="region" aria-label={block.caption} tabIndex={0}><table><caption>{block.caption}</caption><thead><tr>{block.headers.map((h,n)=><th scope="col" key={n}>{h}</th>)}</tr></thead><tbody>{block.rows.map((row,n)=><tr key={n}>{row.map((cell,m)=>m===0?<th scope="row" key={m}>{cell}</th>:<td key={m}>{cell}</td>)}</tr>)}</tbody></table></div>
    <figcaption>{block.note} <a href={block.sourceUrl} rel="noopener noreferrer">{language==='es'?'Fuente: tabla 1':'Source: Table 1'}</a></figcaption>
  </figure>)}</>;
}
