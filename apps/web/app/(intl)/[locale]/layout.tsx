import {notFound} from 'next/navigation';
import {SiteShell} from '../../../components/site-shell';
import '../../globals.css';
import '../../brand.css';
import '../../editorial.css';
import '../../publication.css';
export const metadata={metadataBase:new URL('https://dobrov.org'),title:{default:'Dobrov Academy',template:'%s · Dobrov Academy'},robots:{index:false,follow:false}};
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='ru'&&locale!=='zh')notFound();
 return <SiteShell locale={locale==='ru'?'ru':'zh-Hans'}>{children}</SiteShell>;
}
