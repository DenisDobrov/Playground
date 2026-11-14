/** Public language codes are also the immutable release language keys. */
export const languages=['es','en','ru','zh-Hans'] as const;
export type Language=typeof languages[number];
export const languageNames:Record<Language,string>={es:'Español',en:'English',ru:'Русский','zh-Hans':'简体中文'};
export const languageLocale:Record<Language,string>={es:'es',en:'en-GB',ru:'ru-RU','zh-Hans':'zh-CN'};
export const homePath=(l:Language)=>({es:'/es',en:'/en',ru:'/ru','zh-Hans':'/zh'}[l]);
export const selectText=(l:Language,es:string,en:string,ru:string,zh:string)=>({es,en,ru,'zh-Hans':zh}[l]);
export const whyHeading:Record<Language,string>={es:'Por qué importa',en:'Why it matters',ru:'Почему это важно','zh-Hans':'为什么重要'};
export function normalizeLanguage(value:string|null|undefined):Language|undefined{
 const tag=value?.trim().toLowerCase();if(!tag)return;
 if(/^es(?:-|$)/.test(tag))return 'es';if(/^en(?:-|$)/.test(tag))return 'en';if(/^ru(?:-|$)/.test(tag))return 'ru';
 // The available Chinese edition is explicitly Simplified. Do not treat Hant as Hans.
 if(tag==='zh'||/^zh-(hans(?:-|$)|cn$|sg$)/.test(tag))return 'zh-Hans';
}
export function preferredLanguage(manual:string|undefined,accept:string|null):Language{
 const saved=languages.find(l=>l===manual);if(saved)return saved;
 const preferences=(accept??'').split(',').map((part,index)=>{const [tag,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));const quality=q===undefined?1:Number(q.trim().slice(2));return {language:normalizeLanguage(tag),quality,index};}).filter(p=>p.language&&Number.isFinite(p.quality)&&p.quality>0&&p.quality<=1).sort((a,b)=>b.quality-a.quality||a.index-b.index);
 return preferences[0]?.language??'es';
}
export function rememberLanguage(language:Language){document.cookie=`da-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;}
