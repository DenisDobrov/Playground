import {notFound} from 'next/navigation';
import {NewsHome,NewsListing} from '../../../../components/news-listing';
import {NewsArticle,NewsDigest} from '../../../../components/news-public';
import {NewsMethod} from '../../../../components/news-method';
import {newsReleases,articleMetadata,newsMetadata,resolveNewsRelease} from '../../../../lib/news';
import {homePath,selectText as t,type Language} from '../../../../lib/news-languages';
export const dynamic='force-dynamic';
type Props={params:Promise<{locale:string;path?:string[]}>;searchParams:Promise<{q?:string;page?:string;range?:string}>};
function language(locale:string):Language{if(locale==='ru')return 'ru';if(locale==='zh')return 'zh-Hans';notFound();}
export async function generateMetadata({params,searchParams}:Props){
 const {locale,path=[]}=await params,l=language(locale),rows=await newsReleases(),query=await searchParams;
 if(path[0]==='news'&&path.length===2){const r=resolveNewsRelease(rows,l,path[1]);return r?{...articleMetadata(r),...(r.language!==l||r.slug!==path[1])?{robots:{index:false,follow:true}}:{}}:{robots:{index:false}};}
 const titles={news:t(l,'Noticias científicas','Science news','Новости науки','科学新闻'),analysis:t(l,'Análisis','Analysis','Аналитика','分析'),topics:t(l,'Temas','Topics','Темы','主题'),search:t(l,'Buscar','Search','Поиск','搜索'),archive:t(l,'Ediciones semanales','Weekly editions','Недельные выпуски','每周精选'),week:t(l,'La semana en ciencia','The week in science','Неделя в науке','科学周报'),method:t(l,'Fuentes y método','Sources and method','Источники и метод','来源与方法')};
 const title=titles[path[0] as keyof typeof titles]??t(l,'Ciencia con evidencia','Science with evidence','Наука с опорой на доказательства','以证据理解科学');
 const meta=newsMetadata(l,title,t(l,'Fuentes, contexto y límites.','Sources, context and limits.','Источники, контекст и ограничения.','原始来源、背景与局限。'),{[l]:homePath(l)+(path.length?'/'+path.join('/'):'')});
 return rows.some(r=>r.language===l)&&path[0]!=='search'&&!Object.values(query).some(Boolean)?meta:{...meta,robots:{index:false,follow:true}};
}
export default async function Page({params,searchParams}:Props){
 const {locale,path=[]}=await params,l=language(locale);
 if(!path.length)return <NewsHome language={l}/>;
 if(path[0]==='news'&&path.length===2)return <NewsArticle language={l} slug={path[1]}/>;
 if(path[0]==='week'&&path.length===2&&/^\d{4}-\d{2}-\d{2}$/.test(path[1]))return <NewsDigest language={l} start={path[1]}/>;
 if(path[0]==='method'&&path.length===1)return <NewsMethod language={l}/>;
 if(path[0]==='topics'&&path.length===2)return <NewsListing language={l} kind="topics" topic={path[1]} searchParams={await searchParams}/>;
 if(path.length===1&&['news','analysis','topics','search','archive'].includes(path[0]))return <NewsListing language={l} kind={path[0] as 'news'|'analysis'|'topics'|'search'|'archive'} searchParams={await searchParams}/>;
 notFound();
}
