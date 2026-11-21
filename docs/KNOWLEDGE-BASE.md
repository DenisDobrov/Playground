# KB-001 — Private Knowledge Base

21 November 2026. Approved design implemented locally; cloud migration and deployment require separate approval. Entry: `/editorial/knowledge`, linked from newsroom navigation and each news card. Public navigation, media and publication are unchanged.

## Workflow

1. **Библиотека:** literal case-insensitive database search across topics, sources, claims, materials and decision reasons, 20 results per page. Rejected decisions remain searchable. Enable historical versions to inspect earlier news/dossiers.
2. Select a record to inspect original status, source URLs, actual saved quotes/locators, caveats, related records and version history. Research, announcement and publication dates remain separate. A locator does not establish scientific truth.
3. **Контекст для новости:** enter from a news card or choose a current package in the searchable picker. Suggestions explain shared story/source URL/literal tag matches. This first version uses deterministic rules, **not an LLM**: no embeddings, paid calls or provider credentials.
4. Editor chooses **Подтвердить связь** or **Не использовать**; owner comment is optional and separate from the automatic rationale. This approves only a contextual relationship. The two existing publication buttons and source-review requirements are unchanged. Reviewers can read but cannot decide context.
5. Saved links show accepted/rejected/stale status. Changed snapshots require a new decision; a new news package never inherits context approval. History preserves the original source snapshot, rationale, actor and timestamp.

## Existing data and identity

`academy.knowledge_records` is a `security_invoker` projection over existing RLS-protected tables:

| Type | Existing data | Stable identity |
|---|---|---|
| Topic | Concepts and literal normalized article tags | QID or hash of exact normalized tag; no semantic merge |
| Source | Canonical sources/aliases, embedded news sources | Source ID or exact package + ordinal; no automatic promotion into canonical sources |
| Claim | Research claims/evidence/latest persisted source-meaning review; embedded news dossier claims | Claim ID or package + ordinal; original claim ID retained |
| Material | News packages and research dossier revisions | Immutable package/dossier ID |
| Decision | Human editorial decisions and news owner decisions | Original ID, actor, timestamp, reason, policy |

`record_hash` covers title, summary, payload and current-version flag; aggregates have deterministic order. A new review, metadata edit, related publication or version transition can conservatively invalidate a link. Agent source checks, owner decisions, research claim status and independent verification stay distinct. No claim is verified by KB reuse.

Only `knowledge_context_decisions` is new persistent data: exact target package/hash, entry/hash + snapshot, authenticated actor/time, accept/reject, optional comment, server-calculated rationale/algorithm, request ID and previous decision. History is append-only. Direct writes are denied. The editor-only RPC re-reads records, validates current package/snapshot/previous decision, serializes concurrent writes and returns the same ID for exact replay. A changed payload with a reused request fails. Context writes do not modify publication, science approvals, outbox or jobs.

No service-role client in web, arbitrary URL fetching, new accounts/roles, source ingestion or paid infrastructure. Anonymous users and nonmembers are denied. Private pages retain no-store/noindex. Missing migration shows an unavailable state, never synthetic knowledge.

## Installation and rollback

Additive local migration: `202611210018_knowledge_base.sql`. Dependencies: existing foundation/ingestion/SCI-003/news schema (001–012, 015). Current web also uses merged language/media features 016–017. KB does **not** require separately gated migration 013. Existing rows are not backfilled or rewritten.

Production requires separate approval for scoped 018 installation and web rollout. Do not run blanket cloud migrations: unrelated unapproved migrations may exist. Preserve cloud journal, Auth/roles and legacy data. Roll back web to its prior revision while retaining additive KB schema/history; do not delete user context decisions.

## Validation

- `npm run typecheck`, `npm test`, `npm run demo`, `npm run build`.
- `npm run db:test`: SQL invoker/permissions/immutability, including `knowledge.test.sql`.
- `npm run test:knowledge:integration`: rollback-only fixtures, RLS/roles, literal Unicode/wildcard search, pagination, rejections, tag dedup, rationale, replay/conflicts, stale source/package/decision gates and no publication/science/job changes.
- `npm run test:knowledge:web`: actual local Auth and Next Server Actions, CSRF, hash tampering, role/anonymous denial, save/replay/reload, optional comment and logout. Unique synthetic users/data are cleaned. Optional `KB_CAPTURE=1` saves filtered synthetic HTML to ignored artifacts, never cookies.
- Existing queue, ledger, import, metadata, research, news, language, related-video and content regressions; comprehensive editorial HTTP suite also exercises KB.

Developer-machine exception: Docker host ports were unavailable in Windows. Tests used a temporary loopback transport to the **same local containers**. The CLI pgTAP wrapper could not reach that host connection from its test container; original SQL files were run directly with TAP count/result assertions. The full editorial HTTP suite hit its existing five-second readiness deadline over the temporary transport; the dedicated KB HTTP suite passed. Readiness was not weakened. CI runs the normal network configuration; see PR for final results.

## Limits

This is private retrieval/context, not AI chat or automatic research. Matching is exact story/URL/tag, not semantic search or identity resolution. Search covers projected metadata, claims and reasons, not full-text PDFs. Raw imported-review documents remain in the existing archive. Links do not automatically modify briefs, published revisions or future prompts.

Display bounds: 8 suggestions, 20 targets per search, 20 history entries/material versions per card, 12 related links and 50 latest distinct context decisions per target. Earlier history remains stored. Larger catalogs need profiling and possibly a private search index. Source snapshot writes have a 128 KiB limit.

## Visual inspection

Rendered local synthetic page: [desktop](assets/knowledge-base-desktop.png), [mobile, 390 px](assets/knowledge-base-mobile.png). No horizontal overflow at 390 px. These are UI test records, not production knowledge or scientific validation.

GitHub Actions subsequently passed the complete database suite on the normal network, including standard pgTAP, KB HTTP and the comprehensive editorial Auth/readiness/CSRF workflow. The local transport limitation did not reproduce in CI.
