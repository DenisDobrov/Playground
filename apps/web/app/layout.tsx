import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Umbral · Ciencia con evidencia',
  description: 'Prototipo de una redacción científica: fuentes, contexto y límites.',
  robots: { index: false, follow: false }
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>
    <div className="demo-banner">PROTOTIPO LOCAL · Datos ficticios · Sin publicaciones reales</div>
    <header className="masthead"><Link className="wordmark" href="/">umbral<span>CIENCIA CON EVIDENCIA</span></Link>
      <nav aria-label="Navegación principal"><Link href="/">El portal</Link><Link href="/editorial">La redacción</Link><Link href="/politica">Nuestro método ↗</Link></nav>
    </header>
    {children}
    <footer><span>UMBRAL / nombre provisional</span><span>Fuentes en inglés. Explicaciones en español. Evidencia a la vista.</span><Link href="/politica">Política editorial</Link></footer>
  </body></html>;
}
