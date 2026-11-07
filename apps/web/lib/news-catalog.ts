import {foldText,pageNumber} from './news-presentation';
export interface NewsCatalogEntry {story_id:string;package_id:string;decision:string|null;suggested_video:boolean;suggested_science:boolean;package:{en_title:string;es_title:string;slug:string}}
export function catalogSelection(entries:NewsCatalogEntry[],params:{view?:string;q?:string;page?:string}){
  const view=['all','video','science'].includes(params.view??'')?params.view:'new',query=typeof params.q==='string'?params.q.trim().slice(0,200):'';
  const words=foldText(query).split(/\s+/).filter(Boolean);
  const filtered=entries.filter(e=>(view==='all'||view==='video'?view==='all'||e.suggested_video:view==='science'?e.suggested_science:e.decision===null)&&words.every(w=>foldText([e.package.en_title,e.package.es_title,e.package.slug].join(' ')).includes(w)));
  const pages=Math.max(1,Math.ceil(filtered.length/12)),page=Math.min(pageNumber(params.page),pages);
  return {view,query,page,pages,count:filtered.length,videoCount:entries.filter(e=>e.suggested_video).length,items:filtered.slice((page-1)*12,page*12)};
}
