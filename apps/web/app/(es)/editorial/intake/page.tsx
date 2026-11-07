import {Inbox} from '../inbox';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{notice?:string}>}) {return <Inbox notice={(await searchParams).notice}/>;}
