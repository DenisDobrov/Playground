import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { brand } from '../lib/brand';
import { SiteNotice } from './site-notice';
import {NewsNavigation} from './news-navigation';
export function SiteShell({ locale, children }: { locale: 'es' | 'en'; children: React.ReactNode }) {
  const en = locale === 'en'; const home = en ? '/en' : '/'; const policy = en ? '/en/method' : '/politica';
  return <html lang={locale}><body>
    <a className="skip-link" href="#main-content">{en?'Skip to content':'Saltar al contenido'}</a><SiteNotice locale={locale}/>
    <header className="masthead"><Link className="wordmark" href={home} aria-label={`${brand.name} — ${en ? 'home' : 'inicio'}`}><BrandLogo /></Link>
      <NewsNavigation language={locale}/>
    </header>{children}
    <footer className="publication-footer"><div><span className="footer-brand">{brand.name}<span>{en?'Science with evidence.':brand.taglineEs}</span></span><p>{en?'Sources. Context. Perspective.':'Fuentes. Contexto. Perspectiva.'}</p></div><nav aria-label={en?'About this publication':'Sobre la publicación'}><Link href={policy}>{en?'Sources & method':'Fuentes y método'}</Link><Link href={`${policy}#corrections`}>{en?'Corrections':'Correcciones'}</Link><Link href={`${policy}#privacy`}>{en?'Privacy':'Privacidad'}</Link><a href="mailto:academy@dobrov.org">{en?'Contact':'Contacto'}</a><Link href="/editorial/news">{en?'Private newsroom':'Redacción privada'}</Link></nav><nav aria-label={en?'Official channels':'Canales oficiales'}><a href="https://t.me/dobrovacademy">Telegram</a><a href="https://x.com/DobrovAcademy">X</a><a href="https://whatsapp.com/channel/0029VbDqlX2JP21B9kIR2m0U">WhatsApp</a><a href="https://www.instagram.com/dobrovacademy/">Instagram</a><a href="https://www.threads.com/@dobrovacademy">Threads</a><a href="https://bsky.app/profile/dobrovacademy.bsky.social">Bluesky</a></nav></footer>
  </body></html>;
}
