import {z} from 'zod';

export const NEWS_POLICY='news-release/1';
export const newsChannels=['telegram','x','bluesky','linkedin','facebook','instagram','threads','youtube_posts','whatsapp_channel'] as const;
const safeUrl=z.string().url().refine(s=>{
  const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;
},'HTTPS source required');
const article=z.object({
  title:z.string().min(3).max(300),
  paragraphs:z.array(z.string().min(1).max(5000)).min(1).max(20),
  limitations:z.string().min(1).max(4000)
}).strict();
export const newsPackageSchema=z.object({
  policy:z.literal(NEWS_POLICY),
  slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  eventKey:z.string().min(5).max(500),section:z.number().int().min(1).max(17),
  period:z.literal('2026-11-01/2026-11-07'),en:article,es:article,
  sources:z.array(z.object({
    url:safeUrl,title:z.string().min(1),kind:z.enum(['journal','preprint','institution','vendor','coverage']),
    access:z.enum(['abstract','full_text','announcement','metadata_only']),
    studyDate:z.string().nullable(),announcementDate:z.string().nullable(),checkedAt:z.string().datetime(),finding:z.string().min(1)
  }).strict()).min(1),
  verification:z.object({status:z.enum(['checked_summary','blocked']),reason:z.string(),independentScientificVerification:z.literal('not_performed')}).strict(),
  changes:z.array(z.object({original:z.string(),replacement:z.string(),reason:z.string(),source:safeUrl}).strict()),
  suggestions:z.object({video:z.boolean(),sciencePublication:z.boolean(),videoReason:z.string(),scienceReason:z.string(),provenance:z.literal('ai_suggested')}).strict(),
  channelTexts:z.record(z.enum(newsChannels),z.object({en:z.string().max(10000),es:z.string().max(10000)})),
  provenance:z.object({method:z.literal('codex_assisted_source_checked'),modelApiCalls:z.literal(0),sourceHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
}).strict();
export type NewsPackage=z.infer<typeof newsPackageSchema>;
/** Suggestions never dispatch work. News dispatch accepts only selected news deliveries. */
export function newsExecutionKind(kind:string){
  if(!['web_news','social_news'].includes(kind))throw new Error('NEWS_FREEZE: video, TTS, scripts and manuscripts are disabled');
  return kind;
}
export function suggestionDefaults(section:number){return {video:[2,7,16].includes(section),sciencePublication:false,provenance:'ai_suggested' as const};}
