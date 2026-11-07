'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {Analytics} from '@vercel/analytics/react';
import {filterPublicView,type PublicView} from '../lib/public-analytics';

export function PublicAnalytics({path,enabled}:{path:string;enabled:boolean}) {
  const pathname=usePathname(),[mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  const beforeSend=(event:PublicView)=>filterPublicView(event,path,{currentUrl:window.location.href,referrer:document.referrer,
    doNotTrack:navigator.doNotTrack,globalPrivacyControl:(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl});
  if(!enabled||!mounted||pathname!==path||!beforeSend({type:'pageview',url:window.location.href}))return null;
  // Explicit route/path disables automatic history tracking. Unmounted private pages never emit.
  return <Analytics mode="production" debug={false} framework="next" route={path} path={path} beforeSend={beforeSend}
    configString={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG} basePath={process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH}/>;
}
