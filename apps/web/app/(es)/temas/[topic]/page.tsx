import {NewsListing} from '../../../../components/news-listing';
import {listingMetadata} from '../../../../lib/news-listing-seo';
export const dynamic='force-dynamic';
type Props={params:Promise<{topic:string}>;searchParams:Promise<{q?:string;page?:string;range?:string}>};
export async function generateMetadata({params,searchParams}:Props){return listingMetadata('es','topics',await searchParams,(await params).topic);}
export default async function Page({params,searchParams}:Props){return <NewsListing language="es" kind="topics" topic={(await params).topic} searchParams={await searchParams}/>;}
