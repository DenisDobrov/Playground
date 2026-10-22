import type { Metadata } from 'next';
import { SiteShell } from '../../components/site-shell';
import '../globals.css';
import '../brand.css';
import '../editorial.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  title: { default: 'Dobrov Academy · Science with evidence', template: '%s · Dobrov Academy' },
  description: 'AI, physics and space. Discoveries explained with sources, context and limits.',
  openGraph: { title: 'Dobrov Academy', locale: 'en_US', type: 'website' }, robots: { index: false, follow: false }
};
export default function EnglishLayout({ children }: { children: React.ReactNode }) { return <SiteShell locale="en">{children}</SiteShell>; }
