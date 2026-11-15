import type {Language} from './news-languages';
export interface NewsMedia {youtube_id:string|null;youtube_language:Language|null;youtube_configured:boolean;}
const videoId=/^[A-Za-z0-9_-]{11}$/;
/** Parse locally. No network, redirects, oEmbed, arbitrary hosts or executable schemes. */
export function normalizeYouTubeUrl(input:string):{id:string;url:string}|null {
 const text=input.trim();if(!text)return null;if(text.length>2048)throw Error('Invalid YouTube URL');
 let u:URL;try{u=new URL(text);}catch{throw Error('Invalid YouTube URL');}
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)throw Error('Invalid YouTube URL');
 const host=u.hostname.toLowerCase(),path=u.pathname.replace(/\/$/,'');let id:string|undefined;
 if(host==='youtu.be')id=path.match(/^\/([^/]+)$/)?.[1];
 else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)){
  if(path==='/watch'){if(u.searchParams.getAll('v').length!==1)throw Error('Ambiguous YouTube URL');id=u.searchParams.get('v')??undefined;}
  else id=path.match(/^\/(?:shorts|live|embed|v)\/([^/]+)$/)?.[1];
 }else if(['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=path.match(/^\/embed\/([^/]+)$/)?.[1];
 if(!id||!videoId.test(id))throw Error('A YouTube video URL is required');
 return {id,url:'https://www.youtube.com/watch?v='+id};
}
export function isYouTubeId(value:unknown):value is string{return typeof value==='string'&&videoId.test(value);}
export const youtubeLinkLabels:Record<Language,string>={es:'Ver vídeo en YouTube',en:'Watch on YouTube',ru:'Смотреть видео на YouTube','zh-Hans':'在 YouTube 上观看视频'};
export function videoLanguageLabel(page:Language,video:Language|null):string|null {
 if(!video)return null;
 const names:Record<Language,Record<Language,string>>={
  es:{es:'Vídeo en español',en:'Vídeo en inglés',ru:'Vídeo en ruso','zh-Hans':'Vídeo en chino simplificado'},
  en:{es:'Video in Spanish',en:'Video in English',ru:'Video in Russian','zh-Hans':'Video in Simplified Chinese'},
  ru:{es:'Видео на испанском',en:'Видео на английском',ru:'Видео на русском','zh-Hans':'Видео на упрощённом китайском'},
  'zh-Hans':{es:'视频语言：西班牙语',en:'视频语言：英语',ru:'视频语言：俄语','zh-Hans':'视频语言：简体中文'}
 };return names[page][video];
}
