export interface SelectionDecision {
  id: string; decision: string; reason: string; created_at: string; actor_type: string; policy_version: string;
}
/** Human selection feedback is not evidence for scientific claims. Hold/revise stay unresolved. */
export function selectionFeedback(decisions: SelectionDecision[]) {
  const savedHumanDecisions = decisions.filter(d => d.actor_type === 'human' && ['select', 'reject', 'hold', 'revise'].includes(d.decision))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const latest = savedHumanDecisions[0];
  return { humanLabel: latest?.decision ?? null, humanReason: latest?.reason ?? null,
    humanDecisionId: latest?.id ?? null, policyVersion: latest?.policy_version ?? null,
    evaluationReady: latest?.decision === 'select' || latest?.decision === 'reject', savedHumanDecisions };
}
