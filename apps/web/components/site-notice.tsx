'use client';
import {usePathname} from 'next/navigation';
export function SiteNotice({locale}:{locale:'en'|'es'}) {
  const path=usePathname();const demo=/^\/(historias|en\/stories)(\/|$)/.test(path);
  return demo?<div className="demo-banner">{locale==='en'?'DEMONSTRATION · Fictional data, not a news release':'DEMOSTRACIÓN · Datos ficticios, no una publicación científica'}</div>:null;
}
