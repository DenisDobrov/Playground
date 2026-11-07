import {editorialEnabled} from '../lib/editorial-config';
import {publicAnalyticsEnabled} from '../lib/public-analytics';
import {PublicAnalytics} from './public-analytics';
export function PublicPageAnalytics({path}:{path:string}) {
  return <PublicAnalytics path={path} enabled={publicAnalyticsEnabled(process.env.VERCEL_ENV,editorialEnabled())}/>;
}
