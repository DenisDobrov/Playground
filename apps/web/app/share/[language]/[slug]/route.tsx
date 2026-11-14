import {ImageResponse} from 'next/og';
import {newsReleases} from '../../../../lib/news';
import {brand} from '../../../../lib/brand';
import {languages,languageLocale,selectText,type Language} from '../../../../lib/news-languages';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{language:string;slug:string}>}) {
  const {language,slug}=await params;
  if(!languages.includes(language as Language)||!/^[a-z0-9-]{1,180}$/.test(slug))return new Response('Not found',{status:404});
  const release=(await newsReleases()).find(r=>r.language===language&&r.slug===slug);
  if(!release)return new Response('Not found',{status:404});
  const title=release.content.article.title;
  return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'64px',background:brand.colors.paper,color:brand.colors.ink}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`3px solid ${brand.colors.blue}`,paddingBottom:24}}><span style={{fontSize:38,fontWeight:700}}>dobrov. ACADEMY</span><span style={{fontSize:20,color:brand.colors.blue}}>{language.toUpperCase()} · {new Date(release.first_published_at??release.published_at).toLocaleDateString(languageLocale[release.language],{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span></div>
    <div style={{fontSize:title.length>110?46:58,lineHeight:1.12,letterSpacing:-1}}>{title}</div>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:24,color:brand.colors.muted}}><span>{selectText(release.language,'Fuentes. Contexto. Límites.','Sources. Context. Limits.','Источники. Контекст. Ограничения.','来源、背景与局限。')}</span><span>dobrov.org</span></div>
  </div>,{width:1200,height:630,headers:{'Cache-Control':'public, max-age=300, s-maxage=300','X-Robots-Tag':'noindex'}});
}
