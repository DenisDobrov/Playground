import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '../components/brand-logo';
import { brand } from '../lib/brand';
import './globals.css';
import './brand.css';
import './editorial.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  title: { default: `${brand.name} · Ciencia con evidencia`, template: `%s · ${brand.name}` },
  description: brand.descriptionEs,
  applicationName: brand.name,
  openGraph: { title: brand.name, description: brand.descriptionEs, siteName: brand.name, locale: 'es_ES', type: 'website' },
  twitter: { card: 'summary_large_image', title: brand.name, description: brand.descriptionEs },
  robots: { index: false, follow: false }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>
    <div className="demo-banner">PORTAL EN VISTA PREVIA · Artículos públicos de demostración</div>
    <header className="masthead"><Link className="wordmark" href="/" aria-label={`${brand.name} — inicio`}><BrandLogo /></Link>
      <nav aria-label="Navegación principal"><Link href="/">El portal</Link><Link href="/editorial">La redacción</Link><Link href="/politica">Nuestro método ↗</Link></nav>
    </header>
    {children}
    <footer><span className="footer-brand">{brand.name}<span>{brand.taglineEs}</span></span><span>Fuentes en inglés. Explicaciones en español. Evidencia a la vista.</span><Link href="/politica">Política editorial</Link></footer>
  </body></html>;
}
