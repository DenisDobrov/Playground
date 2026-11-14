'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {methodPath} from '../lib/news-seo';
import {publicListingPath,translatedPath,type Language} from '../lib/news-presentation';
import {languages,languageNames,rememberLanguage,selectText as t} from '../lib/news-languages';
export function NewsNavigation({language:l}:{language:Language}){
 const path=usePathname();
 const items=[['news',t(l,'Noticias','News','Новости','新闻')],['analysis',t(l,'Análisis','Analysis','Аналитика','分析')],['archive',t(l,'Resumen semanal','Weekly digest','По неделям','每周精选')],['topics',t(l,'Temas','Topics','Темы','主题')],['search',t(l,'Buscar','Search','Поиск','搜索')]] as const;
 return <><nav className="publication-nav" aria-label={t(l,'Navegación principal','Main navigation','Главное меню','主导航')}>{items.map(([kind,label])=><Link key={kind} href={publicListingPath(l,kind)}>{label}</Link>)}<Link href={methodPath(l)}>{t(l,'Acerca de','About','О проекте','关于我们')}</Link></nav>
 <nav className="language-nav" aria-label={t(l,'Idioma','Language','Язык','语言')}>{languages.map(language=><Link key={language} href={translatedPath(path,language)} hrefLang={language} aria-current={l===language?'page':undefined} onClick={()=>rememberLanguage(language)}>{languageNames[language]}</Link>)}</nav></>;
}
