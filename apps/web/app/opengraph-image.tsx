import { ImageResponse } from 'next/og';
import { brand } from '../lib/brand';

export const alt = 'Dobrov Academy · Ciencia con evidencia';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: brand.colors.paper, padding: '66px', color: brand.colors.ink }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width="88" height="88" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill={brand.colors.ink}/><path d="M28 24v48h14c32 0 32-48 0-48H28Z" fill="none" stroke={brand.colors.paper} strokeWidth="7"/><path d="M47 48h31" stroke="#7195FF" strokeWidth="7"/></svg>
      <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 55, fontWeight: 700, letterSpacing: -2 }}>dobrov.</span><span style={{ fontSize: 17, letterSpacing: 8 }}>ACADEMY</span></div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}><span style={{ fontSize: 78, letterSpacing: -3 }}>Ciencia con evidencia.</span><span style={{ color: brand.colors.muted, fontSize: 27 }}>Inteligencia artificial · Física · Espacio</span></div>
    <div style={{ display: 'flex', borderTop: `2px solid ${brand.colors.blue}`, paddingTop: 24, color: brand.colors.blue, fontSize: 20 }}>Fuentes. Contexto. Perspectiva.</div>
  </div>, size);
}
