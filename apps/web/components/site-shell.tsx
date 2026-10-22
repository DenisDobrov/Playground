import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { brand } from '../lib/brand';
export function SiteShell({ locale, children }: { locale: 'es' | 'en'; children: React.ReactNode }) {
  const en = locale === 'en'; const home = en ? '/en' : '/'; const policy = en ? '/en/method' : '/politica';
  return <html lang={locale}><body>
    <div className="demo-banner">{en ? 'PORTAL PREVIEW · Public articles use fictional demonstration data' : 'PORTAL EN VISTA PREVIA · Artículos públicos de demostración'}</div>
    <header className="masthead"><Link className="wordmark" href={home} aria-label={`${brand.name} — ${en ? 'home' : 'inicio'}`}><BrandLogo /></Link>
      <nav aria-label={en ? 'Main navigation' : 'Navegación principal'}><Link href={home}>{en ? 'The portal' : 'El portal'}</Link><Link href="/editorial">{en ? 'Newsroom (ES)' : 'La redacción'}</Link><Link href={policy}>{en ? 'Our method ↗' : 'Nuestro método ↗'}</Link><span><Link href="/" hrefLang="es" aria-current={!en ? 'true' : undefined}>ES</Link> / <Link href="/en" hrefLang="en" aria-current={en ? 'true' : undefined}>EN</Link></span></nav>
    </header>{children}
    <footer><span className="footer-brand">{brand.name}<span>{en ? 'Science with evidence.' : brand.taglineEs}</span></span><span>{en ? 'Sources, context and limits. In Spanish and English.' : 'Fuentes, contexto y límites. En español e inglés.'}</span><Link href={policy}>{en ? 'Editorial policy' : 'Política editorial'}</Link></footer>
  </body></html>;
}
