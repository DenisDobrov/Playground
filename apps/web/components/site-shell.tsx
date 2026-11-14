import {methodPath} from '../lib/news-seo';
import {selectText as tr,homePath,languageLocale,type Language} from '../lib/news-languages';
import Link from 'next/link';
import { BrandLogo } from './brand-logo';
import { brand } from '../lib/brand';
import { SiteNotice } from './site-notice';
import {NewsNavigation} from './news-navigation';
export function SiteShell({ locale, children }: { locale:Language; children: React.ReactNode }) {
  const en = locale === 'en'; const home = homePath(locale); const policy = methodPath(locale);
  return <html lang={locale}><body>
    <a className="skip-link" href="#main-content">{tr(locale,"Saltar al contenido","Skip to content","Перейти к содержанию","跳至正文")}</a><SiteNotice locale={locale==='en'?'en':'es'}/>
    <header className="masthead"><Link className="wordmark" href={home} aria-label={`${brand.name} — ${tr(locale,"inicio","home","главная","首页")}`}><BrandLogo /></Link>
      <NewsNavigation language={locale}/>
    </header>{children}
    <footer className="publication-footer"><div><span className="footer-brand">{brand.name}<span>{tr(locale,brand.taglineEs,'Science with evidence.','Наука с опорой на доказательства.','以证据理解科学。')}</span></span><p>{tr(locale,"Fuentes. Contexto. Perspectiva.","Sources. Context. Perspective.","Источники. Контекст. Перспектива.","来源、背景与视角。")}</p></div><nav aria-label={tr(locale,"Sobre la publicación","About this publication","Об издании","关于本刊")}><Link href={policy}>{tr(locale,"Fuentes y método","Sources & method","Источники и метод","来源与方法")}</Link><Link href={`${policy}#corrections`}>{tr(locale,"Correcciones","Corrections","Исправления","更正")}</Link><Link href={`${policy}#privacy`}>{tr(locale,"Privacidad","Privacy","Конфиденциальность","隐私")}</Link><a href="mailto:academy@dobrov.org">{tr(locale,"Contacto","Contact","Контакты","联系")}</a><Link href="/editorial/news">{tr(locale,"Redacción privada","Private newsroom","Редакция","编辑工作台")}</Link></nav><nav aria-label={tr(locale,"Canales oficiales","Official channels","Официальные каналы","官方频道")}><a href="https://t.me/dobrovacademy">Telegram</a><a href="https://x.com/DobrovAcademy">X</a><a href="https://whatsapp.com/channel/0029VbDqlX2JP21B9kIR2m0U">WhatsApp</a><a href="https://www.instagram.com/dobrovacademy/">Instagram</a><a href="https://www.threads.com/@dobrovacademy">Threads</a><a href="https://bsky.app/profile/dobrovacademy.bsky.social">Bluesky</a><a href="https://www.linkedin.com/company/dobrovacademy/">LinkedIn</a><a href="https://www.facebook.com/profile.php?id=61596320661841">Facebook</a><a href="https://www.youtube.com/@DobrovAcademy">YouTube</a></nav></footer>
  </body></html>;
}
