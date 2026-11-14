import {describe,it,expect} from 'vitest';
import {preparationReviewState} from '../scripts/news-week-validation';
describe('trusted preparation review boundary',()=>{
 it('does not turn missing, pending or unknown work into a completed check',()=>{
  for(const kind of ['source','language'] as const)for(const input of [undefined,null,{},'completed',{status:'pending'},{status:'owner_approved'}])expect(()=>preparationReviewState(input,kind)).toThrow();
 });
 it('retains a failure even if notes claim that another check passed',()=>{
  for(const kind of ['source','language'] as const)for(const status of ['blocked','failed'])expect(preparationReviewState({status,notes:'checked'},kind)).toBe('blocked');
 });
 it('recognizes actual preparation checks without claiming human approval',()=>{
  expect(preparationReviewState({status:'agent_checked',humanApproval:false},'language')).toBe('checked');
  expect(preparationReviewState({status:'agent_source_meaning_checked_with_access_limits'},'source')).toBe('checked');
  expect(()=>preparationReviewState({status:'draft_checked'},'source')).toThrow();
 });
});
