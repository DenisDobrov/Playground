import {NewsMethod} from '../../../components/news-method';
import {newsMetadata} from '../../../lib/news-seo';
import {PublicPageAnalytics} from '../../../components/public-page-analytics';
export const metadata=newsMetadata('es','Método editorial y privacidad','Fuentes, límites, autoría, correcciones y privacidad en Dobrov Academy.',{en:'/en/method',es:'/politica'});
export default function Policy(){return <NewsMethod language="es"/>;}
