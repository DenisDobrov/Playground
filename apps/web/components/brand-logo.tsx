import Image from 'next/image';
import { brand } from '../lib/brand';

export function BrandLogo() {
  return <span className="brand-lockup">
    <Image className="brand-symbol" src="/brand/mark.svg" alt="" width={48} height={48} priority />
    <span className="brand-type"><span className="brand-name">dobrov<span className="brand-period">.</span></span><span className="brand-academy">ACADEMY</span></span>
    <span className="sr-only">{brand.name}</span>
  </span>;
}
