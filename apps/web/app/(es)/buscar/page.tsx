import {NewsListing} from '../../../components/news-listing';
import {listingMetadata} from '../../../lib/news-listing-seo';
export const dynamic='force-dynamic';
type Props={searchParams:Promise<{q?:string;page?:string;range?:string}>};
export async function generateMetadata({searchParams}:Props){return listingMetadata('es','search',await searchParams);}
export default async function Page({searchParams}:Props){return <NewsListing language="es" kind="search" searchParams={await searchParams}/>;}
