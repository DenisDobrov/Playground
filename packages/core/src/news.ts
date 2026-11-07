import {z} from 'zod';

export const NEWS_POLICY='news-release/1';
export const newsChannels=['telegram','x','bluesky','linkedin','facebook','instagram','threads','youtube_posts','whatsapp_channel'] as const;
const safeUrl=z.string().url().refine(s=>{
  const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password;
},'HTTPS source required');
export const newsTopics=['ai','physics-space','quantum','origins-life','brain','longevity','energy-technology'] as const;
const table=z.object({type:z.literal('table'),caption:z.string().min(1).max(800),headers:z.array(z.string().min(1).max(300)).min(2).max(6),rows:z.array(z.array(z.string().min(1).max(500))).min(1).max(20),sourceUrl:safeUrl,note:z.string().min(1).max(2000)}).strict().refine(t=>t.rows.every(r=>r.length===t.headers.length),'Table cells must match headers');
const article=z.object({
  title:z.string().min(3).max(300),
  paragraphs:z.array(z.string().min(1).max(5000)).min(1).max(60),
  limitations:z.string().min(1).max(4000),
  type:z.enum(['news','analysis']).optional(),topic:z.enum(newsTopics).optional(),
  secondaryTopics:z.array(z.enum(newsTopics)).max(3).optional(),
  sourcePublicationMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  blocks:z.array(z.discriminatedUnion('type',[
    z.object({type:z.literal('paragraph'),text:z.string().min(1).max(5000)}).strict(),
    z.object({type:z.literal('heading'),text:z.string().min(1).max(300)}).strict(),table
  ])).min(1).max(100).optional()
}).strict().refine(a=>!a.blocks||JSON.stringify(a.blocks.filter(b=>b.type==='paragraph').map(b=>b.text))===JSON.stringify(a.paragraphs),'Paragraph index must match the immutable body');
export const newsPackageSchema=z.object({
  policy:z.literal(NEWS_POLICY),
  slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  eventKey:z.string().min(5).max(500),section:z.number().int().min(1).max(17),
  period:z.union([z.literal('2026-11-01/2026-11-07'),z.string().regex(/^standalone:\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v.slice(11)))&&new Date(v.slice(11)).toISOString().slice(0,10)===v.slice(11),'Valid publication preparation date required')]),en:article,es:article,
  sources:z.array(z.object({
    url:safeUrl,title:z.string().min(1),kind:z.enum(['journal','preprint','institution','vendor','coverage']),
    access:z.enum(['abstract','full_text','announcement','metadata_only']),
    studyDate:z.string().nullable(),announcementDate:z.string().nullable(),checkedAt:z.string().datetime(),finding:z.string().min(1),
    related:z.array(z.object({url:safeUrl,label:z.string().min(1).max(200)}).strict()).max(3).optional()
  }).strict()).min(1),
  verification:z.object({status:z.enum(['checked_summary','blocked']),reason:z.string(),independentScientificVerification:z.literal('not_performed')}).strict(),
  changes:z.array(z.object({original:z.string(),replacement:z.string(),reason:z.string(),source:safeUrl}).strict()),
  suggestions:z.object({video:z.boolean(),sciencePublication:z.boolean(),videoReason:z.string(),scienceReason:z.string(),provenance:z.literal('ai_suggested'),
    videoRecommendation:z.object({version:z.literal('news-002/1'),en:z.object({reason:z.string().min(1),visualAngle:z.string().min(1),caveat:z.string().min(1)}).strict(),es:z.object({reason:z.string().min(1),visualAngle:z.string().min(1),caveat:z.string().min(1)}).strict()}).strict().optional()
  }).strict(),
  channelTexts:z.partialRecord(z.enum(newsChannels),z.object({en:z.string().max(10000),es:z.string().max(10000)})).refine(t=>Object.keys(t).length>0,'At least one selected channel required'),
  // Private, immutable review assets. Public release DTOs deliberately omit this field.
  campaign:z.object({
    id:z.string().regex(/^[a-z0-9-]{3,80}$/),
    title:z.string().min(1).max(200),
    basePackageId:z.string().uuid(),
    basePackageHash:z.string().regex(/^[a-f0-9]{64}$/),
    assets:z.array(z.object({
      language:z.enum(['es','en']),alt:z.string().min(1).max(1000),
      mime:z.literal('image/png'),width:z.literal(1080),height:z.literal(1350),
      sha256:z.string().regex(/^[a-f0-9]{64}$/),
      dataUrl:z.string().max(350000).regex(/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/),
      rights:z.literal('original_dobrov_academy_typography')
    }).strict()).length(2).refine(a=>new Set(a.map(x=>x.language)).size===2,'One image per language required')
  }).strict().optional(),
  provenance:z.object({method:z.literal('codex_assisted_source_checked'),modelApiCalls:z.literal(0),sourceHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
}).strict().refine(p=>[p.en,p.es].every(a=>!a.blocks||a.blocks.every(b=>b.type!=='table'||p.sources.some(s=>s.url===b.sourceUrl))),'Table must cite a package source');
export type NewsPackage=z.infer<typeof newsPackageSchema>;
/** Suggestions never dispatch work. News dispatch accepts only selected news deliveries. */
export function newsExecutionKind(kind:string){
  if(!['web_news','social_news'].includes(kind))throw new Error('NEWS_FREEZE: video, TTS, scripts and manuscripts are disabled');
  return kind;
}
export function suggestionDefaults(section:number){return {video:[2,7,16].includes(section),sciencePublication:false,provenance:'ai_suggested' as const};}
export function textContentKinds(kind:string):('article_es'|'article_en')[]{
  if(kind==='all')return ['article_es','article_en'];
  if(kind==='article_es'||kind==='article_en')return [kind];
  throw new Error('NEWS_FREEZE: only article_es/article_en are enabled');
}
