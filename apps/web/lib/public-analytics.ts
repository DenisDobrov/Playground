export interface PublicView {type:'pageview'|'event';url:string}
export interface PrivacyContext {currentUrl:string;referrer:string;doNotTrack?:string|null;globalPrivacyControl?:boolean}
/** Fail closed. Only the exact released page mounted by a public server component can send. */
export function filterPublicView(event:PublicView,path:string,context:PrivacyContext):PublicView|null {
  if(event.type!=='pageview'||context.doNotTrack==='1'||context.globalPrivacyControl)return null;
  try {
    const current=new URL(context.currentUrl),url=new URL(event.url);
    const hosts=['dobrov.org','www.dobrov.org'];
    if(!['https://dobrov.org','https://www.dobrov.org'].includes(current.origin)||current.username||current.password||url.username||url.password||url.origin!==current.origin||current.pathname!==path||url.pathname!==path)return null;
    if(!/^\/(?:$|en$|politica$|en\/method$|noticias\/[a-z0-9-]+$|en\/news\/[a-z0-9-]+$|semana\/2026-11-01$|en\/week\/2026-11-01$)/.test(path))return null;
    // The SDK does not expose referrer rewriting. Drop potentially sensitive referrers entirely.
    if(context.referrer){const ref=new URL(context.referrer);if(ref.search||ref.hash||ref.username||ref.password||(hosts.includes(ref.hostname)&&/^\/(editorial|login|auth|api)(\/|$)/.test(ref.pathname)))return null;}
    return {type:'pageview',url:current.origin+path};
  }catch{return null;}
}
export const publicAnalyticsEnabled=(environment:string|undefined,live:boolean)=>environment==='production'&&live;
