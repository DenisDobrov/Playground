import type {SpanishScriptDraft,ContentInput} from '@science/core';
import type {HybridScene} from './hybrid';
/** Planned scenes only: no assets, fabricated reviews, audio timing or render approval. */
export function contentSceneDrafts(script:SpanishScriptDraft,revisionId:string,inputHash:string,input:ContentInput):HybridScene[] {
 return script.scenes.map(s=>({id:s.id,type:s.type,scriptRevisionId:revisionId,scriptInputHash:inputHash,narrationEs:s.narrationEs,sourceClaimIds:s.sourceClaimIds,requiredCaveats:s.caveatIds.map(id=>input.brief.mandatoryCaveats[Number(id.replace('caveat-',''))]),visualAssets:[],audioAsset:null,duration:s.durationEstimateSeconds,explanatoryLabelEs:s.explanatoryLabelEs||null,presenterMode:s.type==='presenter_insert'?'still_motion':null,scientificReview:{status:'pending',inputHash:''},visualReview:null,outputHash:null}));
}
