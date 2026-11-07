'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {digestPath,methodPath} from '../lib/news-seo';
import {publicListingPath,translatedPath,type Language} from '../lib/news-presentation';
export function NewsNavigation({language}:{language:Language}){
  const path=usePathname(),en=language==='en';
  return <><nav className="publication-nav" aria-label={en?'Main navigation':'Navegación principal'}>
    <Link href={publicListingPath(language,'news')}>{en?'News':'Noticias'}</Link><Link href={publicListingPath(language,'analysis')}>{en?'Analysis':'Análisis'}</Link>
    <Link href={digestPath(language)}>{en?'Weekly digest':'Resumen semanal'}</Link><Link href={publicListingPath(language,'topics')}>{en?'Topics':'Temas'}</Link>
    <Link href={methodPath(language)}>{en?'About':'Acerca de'}</Link><Link href={publicListingPath(language,'search')}>{en?'Search':'Buscar'}</Link>
  </nav><nav className="language-nav" aria-label={en?'Language':'Idioma'}><Link href={translatedPath(path,'es')} hrefLang="es" aria-current={!en?'page':undefined}>ES</Link><Link href={translatedPath(path,'en')} hrefLang="en" aria-current={en?'page':undefined}>EN</Link></nav></>;
}
