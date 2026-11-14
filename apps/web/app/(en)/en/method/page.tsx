import {NewsMethod} from '../../../../components/news-method';
import {newsMetadata} from '../../../../lib/news-seo';
import {PublicPageAnalytics} from '../../../../components/public-page-analytics';
export const metadata=newsMetadata('en','Editorial method and privacy','Sources, limits, authorship, corrections and privacy at Dobrov Academy.',{en:'/en/method',es:'/politica'});
export default function Policy(){return <NewsMethod language="en"/>;}
