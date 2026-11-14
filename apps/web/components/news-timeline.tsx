import type {NewsPackage} from '@science/core';
import {selectText as t,languageLocale,type Language} from '../lib/news-languages';
export function NewsTimeline({dates,language:l}:{dates:NonNullable<NewsPackage['research']>['eventDates'];language:Language}){
 const labels={first_public:t(l,'Primera versión pública identificada','Earliest identified public version','Первое установленное обнародование','已确认的最早公开版本'),preprint:t(l,'Preprint','Preprint','Препринт','预印本'),journal:t(l,'Publicación en revista','Journal publication','Журнальная публикация','期刊发表'),announcement:t(l,'Comunicado','Announcement','Пресс-релиз','公告'),news_event:t(l,'Acontecimiento de esta noticia','Current news event','Событие этой новости','本次新闻事件')};
 return <section><h2>{t(l,'Cronología del resultado','Research timeline','Хронология результата','研究时间线')}</h2><ul>{dates.map((d,i)=><li key={i}>{labels[d.kind]}: {d.date?<a href={d.source}><time dateTime={d.date}>{new Date(d.date+'T00:00:00Z').toLocaleDateString(languageLocale[l],{dateStyle:'long',timeZone:'UTC'})}</time></a>:t(l,'no establecida','not established','не установлена','尚未确定')}.</li>)}</ul></section>;
}
