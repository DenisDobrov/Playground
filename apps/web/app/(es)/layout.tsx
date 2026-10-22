import type { Metadata } from 'next';
import { SiteShell } from '../../components/site-shell';
import { brand } from '../../lib/brand';
import '../globals.css';
import '../brand.css';
import '../editorial.css';

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
  return <SiteShell locale="es">{children}</SiteShell>;
}
