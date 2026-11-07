import {newsMetadata,newsReleases} from './news';
import {topics,topicPath,hasTopic,publicListingPath,type NewsTopic,type Language} from './news-presentation';
export async function listingMetadata(language:Language,kind:'news'|'analysis'|'topics'|'search'|'archive',params:{q?:string;page?:string;range?:string},topic?:string){
  const en=language==='en';const titles={news:en?'Science news':'Noticias científicas',analysis:en?'Analysis':'Análisis',topics:en?'Scientific topics':'Temas científicos',search:en?'Search published stories':'Buscar noticias publicadas',archive:en?'Weekly editions':'Ediciones semanales'};
  if(topic&&!Object.hasOwn(topics,topic))return {robots:{index:false,follow:false}};
  const title=topic?topics[topic as NewsTopic][language]:titles[kind];
  const rows=(await newsReleases()).filter(r=>r.language===language);
  const populated=rows.some(r=>(!topic||hasTopic(r,topic))&&(kind!=='analysis'||r.content.article.type==='analysis')&&(kind!=='archive'||r.content.period==='2026-11-01/2026-11-07'));
  const paths={en:topic?topicPath('en',topic as NewsTopic):publicListingPath('en',kind),es:topic?topicPath('es',topic as NewsTopic):publicListingPath('es',kind)};
  return {...newsMetadata(language,title,en?'Research explained with original sources, context and limitations.':'Investigación explicada con fuentes originales, contexto y límites.',paths),robots:{index:populated&&kind!=='search'&&!params.q&&!params.range&&(!params.page||params.page==='1'),follow:true}};
}
