/** Operator-provided file only. This CLI is deliberately hard-bound to isolated local Academy. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {canonicalSourceId} from '@science/sources';
import {validateResearchDraft} from '@science/core';
import {createBudgetStore} from '@science/storage';
import {executeBudgeted,currentBudgetMonth} from '@science/pipeline';
import {extractPdf} from './primary-document';
import {enrichMetadata} from './metadata';
if(process.env.SUPABASE_URL!=='http://127.0.0.1:56321') throw new Error('Only isolated local Academy allowed');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY!,{db:{schema:'academy'},auth:{persistSession:false}});
const identity=canonicalSourceId(config.identity);const bytes=await readFile(config.pdf);
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');const checksum=hash(bytes);
const [{data:source,error},metadata]=await Promise.all([db.from('source_aliases').select('source_id').eq('alias',identity).single(),enrichMetadata(identity)]);
if(error||!source) throw new Error('Existing Source required');
const {data:snapshot}=await db.from('metadata_snapshots').select('*').eq('id',metadata.snapshotId).single();if(!snapshot) throw new Error('Primary metadata required');
const {data:links}=await db.from('story_sources').select('story_id').eq('source_id',source.source_id);if(links?.length!==1) throw new Error('Choose an unambiguous existing Story');
const story=links[0].story_id;const started=performance.now();const pages=await extractPdf(bytes);
const draft=validateResearchDraft(JSON.parse(await readFile(config.draft,'utf8')),pages,config.domain);
const inputHash=hash(JSON.stringify({identity,checksum,draft,rights:config.rights,version:config.version}));
await mkdir('artifacts/research-pilot',{recursive:true});
const output=await executeBudgeted(createBudgetStore(),{key:'research-local:'+inputHash,month:currentBudgetMonth(),category:'content',estimateMicros:0,storyId:story,videoKey:null,tool:'local-evidence-intake',toolVersion:'research/1',priceVersion:'local-no-provider-charge/1',inputHash},async({operationId})=>{
 const path='research-operator/'+checksum+'.pdf';
 const upload=await db.storage.from('dobrov-academy-assets').upload(path,bytes,{contentType:'application/pdf',upsert:false});
 if(upload.error) {const old=await db.storage.from('dobrov-academy-assets').download(path);if(old.error||!old.data||hash(new Uint8Array(await old.data.arrayBuffer()))!==checksum) throw new Error('Stored PDF differs');}
 const doc=await db.rpc('save_operator_pdf',{p_snapshot:snapshot.id,p_story:story,p_version:config.version,p_url:config.sourceUrl,p_rights:config.rights,p_checksum:checksum,p_pages:pages,p_object:path});if(doc.error||!doc.data) throw new Error('Primary document persistence failed: '+doc.error?.message);
 const {data:previous}=await db.from('dossiers').select('version').eq('story_id',story).order('version',{ascending:false}).limit(1);
 const command=[inputHash.slice(0,8),inputHash.slice(8,12),inputHash.slice(12,16),inputHash.slice(16,20),inputHash.slice(20,32)].join('-');
 const result=await db.rpc('save_agent_dossier',{p_document:doc.data,p_draft:draft,p_expected:previous?.[0]?.version||0,p_command:command});if(result.error||!result.data) throw new Error('Dossier persistence failed: '+result.error?.message);
 const report={operationId,identity,title:snapshot.normalized.title,sourceUrl:config.sourceUrl,documentId:doc.data,dossierId:result.data,documentChecksum:checksum,documentVersion:config.version,pages:pages.length,claims:draft.claims.length,quoteBackedClaims:draft.claims.filter(c=>c.evidenceKeys.length).length,unsupportedClaims:draft.claims.filter(c=>!c.evidenceKeys.length).length,humanReview:'pending; no approval manufactured',reviewEffortSeconds:null,providerCostUsd:0,processingMilliseconds:Math.round(performance.now()-started),localReviewUrl:'http://localhost:3000/editorial/research?dossier='+result.data,brief:{preliminary:true,...draft.planning,mandatoryCaveats:draft.claims.map(c=>c.caveatEn),approvedFindings:[],scientificReview:'pending'}};
 await writeFile('artifacts/research-pilot/demonstration.json',JSON.stringify(report,null,2));await writeFile('artifacts/research-pilot/dossier.json',JSON.stringify(draft,null,2));
 return {output:report,actualMicros:0,usage:{},reference:'local-research:'+hash(JSON.stringify(report))};
});
console.log(JSON.stringify(output));
