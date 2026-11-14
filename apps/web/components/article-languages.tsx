'use client';
import Link from 'next/link';
import {newsPath} from '../lib/news-seo';
import {languageNames,rememberLanguage,type Language} from '../lib/news-languages';
export function ArticleLanguages({available,current,slug,paths}:{available:Language[];current:Language;slug:string;paths?:Partial<Record<Language,string>>}){
 return <p>{available.filter(l=>l!==current).map(l=><Link key={l} href={paths?.[l]??newsPath(l,slug)} hrefLang={l} onClick={()=>rememberLanguage(l)}>{languageNames[l]} · </Link>)}</p>;
}
