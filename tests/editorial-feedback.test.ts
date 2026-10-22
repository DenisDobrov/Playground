import { describe, it, expect } from 'vitest';
import { selectionFeedback } from '../packages/core/src/selection-gold';
import { editorialQuery, literalSearch, decisionReturnPath } from '../apps/web/lib/editorial-query';
describe('editorial feedback boundaries', () => {
  it('keeps latest human reason and policy, excluding agent votes and publication approval', () => {
    const make = (id: string, decision: string, actor_type = 'human') => ({ id, decision, actor_type, reason: `Reason ${id}`, created_at: `2026-10-${id}T12:00:00Z`, policy_version: 'selection/1' });
    const result = selectionFeedback([make('21','reject'), make('22','hold'), make('23','select','agent'), make('24','approve')]);
    expect(result.humanLabel).toBe('hold');
    expect(result.humanReason).toBe('Reason 22');
    expect(result.policyVersion).toBe('selection/1');
    expect(result.evaluationReady).toBe(false);
    expect(result.savedHumanDecisions.map(d=>d.id)).toEqual(['22','21']);
    expect(selectionFeedback([make('21','select')]).evaluationReady).toBe(true);
    expect(selectionFeedback([]).humanLabel).toBe(null);
  });
  it('does not allow form redirects outside the catalog or unknown filter values', () => {
    for (const path of ['https://attacker.example','//attacker.example','/editorial/stories/../../login','/editorial/stories-other']) expect(decisionReturnPath(path)).toBe('/editorial');
    expect(decisionReturnPath('/editorial/stories?q=space&status=held&evil=1')).toBe('/editorial/stories?q=space&status=held');
    expect(editorialQuery({q:['one','two'],status:'bad',page:'NaN'})).toMatchObject({q:'',status:'',page:1});
    expect(literalSearch('100%_test\\')).toBe('%100\\%\\_test\\\\%');
  });
});
