const languagePassed=new Set(['draft_checked','agent_checked','completed']);
const sourcePassed=new Set(['checked_summary','agent_source_meaning_checked','agent_source_meaning_checked_with_access_limits','completed','completed_with_access_limitations','completed_with_material_access_limitations']);
/** Imported preparation records are evidence of checks only in their explicit supported states. */
export function preparationReviewState(value:unknown,kind:'source'|'language'):'checked'|'blocked'{
 if(!value||typeof value!=='object'||!('status' in value)||typeof value.status!=='string')throw Error(`Missing ${kind} check`);
 if(value.status==='blocked'||value.status==='failed')return 'blocked';
 if(!(kind==='language'?languagePassed:sourcePassed).has(value.status))throw Error(`Unsupported ${kind} check status`);
 return 'checked';
}
