import type {MetadataRoute} from 'next';
import {digestPath,methodPath,newsOrigin,newsPath,newsReleases} from '../lib/news';
import {languages,homePath,type Language} from '../lib/news-languages';
import {topics,hasTopic,topicPath,publicListingPath,type NewsTopic} from '../lib/news-presentation';

export const dynamic='force-dynamic';

export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const rows=await newsReleases();
  if(!rows.length)return [];

  const alternatives=(paths:Partial<Record<Language,string>>)=>{
    const result:Record<string,string>=Object.fromEntries(Object.entries(paths).map(([language,path])=>[language,newsOrigin+path]));
    if(paths.es)result['x-default']=newsOrigin+paths.es;
    return result;
  };
  const localizedPages=(eligible:typeof rows,pathFor:(language:Language)=>string):MetadataRoute.Sitemap=>{
    const available=languages.filter(language=>eligible.some(row=>row.language===language));
    const paths=Object.fromEntries(available.map(language=>[language,pathFor(language)]));
    return available.map(language=>({url:newsOrigin+pathFor(language),alternates:{languages:alternatives(paths)}}));
  };

  const articles:MetadataRoute.Sitemap=rows.map(row=>{
    const available=row.availableLanguages??[row.language];
    const translations=rows.filter(other=>other.story_id===row.story_id&&available.includes(other.language));
    // Resolve each released translation's own slug; an absent edition has no URL.
    const paths=Object.fromEntries(translations.map(other=>[other.language,newsPath(other.language,other.slug)]));
    return {url:newsOrigin+newsPath(row.language,row.slug),lastModified:row.modified_at??row.published_at,alternates:{languages:alternatives(paths)}};
  });
  const weeklyRows=rows.filter(row=>/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(row.content.period));
  const starts=[...new Set(weeklyRows.map(row=>row.content.period.slice(0,10)))].sort();

  return [
    ...articles,
    ...localizedPages(rows,homePath),
    ...localizedPages(rows,methodPath),
    ...localizedPages(rows,language=>publicListingPath(language,'news')),
    ...localizedPages(rows,language=>publicListingPath(language,'topics')),
    ...localizedPages(rows.filter(row=>row.content.article.type==='analysis'),language=>publicListingPath(language,'analysis')),
    ...localizedPages(weeklyRows,language=>publicListingPath(language,'archive')),
    ...starts.flatMap(start=>localizedPages(weeklyRows.filter(row=>row.content.period.startsWith(start+'/')),language=>digestPath(language,start))),
    ...Object.keys(topics).flatMap(topic=>localizedPages(rows.filter(row=>hasTopic(row,topic)),language=>topicPath(language,topic as NewsTopic)))
  ];
}
