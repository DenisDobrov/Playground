# SCI-004 real pilot reconciliation and acceptance

31 October 2026. PR11 remains Draft. **Real-paper generation/acceptance is incomplete; do not merge yet.** No user records, approvals, runtime configuration, credentials or cloud migrations were changed by this audit. Existing implementation is preserved. Only a reviewed price card, this report and a future plan are added.

## Read-only database reconciliation

Audit at 14:00:58 UTC / 17:00:58 Africa/Nairobi, using a PostgreSQL `BEGIN READ ONLY` transaction on local Academy 127.0.0.1:56322. The read gate used transaction-local service-role context, not a human session. Private full results are in ignored `artifacts/readiness/reconciliation.json`.

- Dossier: `81117510-272d-4222-9dcf-f87241a8f771`, version 1, author agent, created 05:49:38.690 UTC.
- Dossier input SHA-256: `69ed66239702dba1c2398c5ebd4ab27dad4606148bc7a71b4edc2239b6e7af62`.
- Source document: `e9694152-0943-43d9-9167-adaf60eb622c`, full_text, v1, intake sequence 6. Original checksum: `f14feae673fbebf1b7c75463f37a38756fa75722b079db9f294db9afb6344ad3`.
- There is exactly one dossier and one scientific review in the inspected Academy. No other dossier revision for this Story or source, and no newer primary document for this source.

| Claim key / UUID | Latest persisted human decision | Review version / time |
|---|---|---|
| model / `2909b345-424f-4ba0-bb9e-4a7d13cc5007` | accept | v1, 13:07:21.125 UTC / 16:07:21.125 Nairobi |
| amplitude / `c022bba9-ae29-423b-a8a6-3fbfd76b0b98` | none | no history |
| phase / `b8d8647e-a4e4-40dc-b35b-9bc3705c753e` | none | no history |
| misleading-control / `84dda609-609b-4da9-940c-8db866969b62` | none | no history |
| unsupported-control / `eb0c6281-2727-47fa-9b57-aac3a03fc348` | none | no history |

The one review is `fefac5fb-8c51-4579-829a-5442def20eaf`, by local user `7e8a841d-8ebe-4606-ac8c-3d9027f4daaa`, denis.dobrokhotov@gmail.com, current editor membership. Reason: “Very good dosier”; declared effort 10 seconds. Its input hash exactly matches the dossier. Scientific status remains unverified, as designed.

No whole-dossier scientific approval exists. No Editorial Brief exists, preliminary or final. No content draft exists. Gate reports missing=4, accepted=1, rejected=0, requestRevision=0, stale=false, claimsReady=false, ready=false. Thus this is a genuinely incomplete persisted review, not a stale-hash/approval matching bug. There is no approval requirement to weaken or failing gate logic to patch.

Both main checkout's `.env.local-web` and `.env.local-worker`, and the isolated worktree's `.env.local-worker`, point to the same Academy API 127.0.0.1:56321. Exactly one running Academy database container was found. Other Docker projects were not queried or modified. Main `.env.local` contains the shared cloud URL, but the local web launcher explicitly uses `.env.local-web` and local worker uses `.env.local-worker`. No evidence of another local Academy revision explains additional decisions. Cloud/Vercel review state was not queried; a review performed on another URL cannot be inferred to exist locally. Current tables cannot prove whether an earlier, different database ever held additional records; no lost history or backups are presumed.

## Exact UI steps still required from the human

Open [the target dossier](http://localhost:3000/editorial/research?dossier=81117510-272d-4222-9dcf-f87241a8f771) and use the original PDF/passages shown there. Each claim has its own form; saving one claim does not approve the whole dossier.

1. Review **amplitude**: calculated amplitudes 1.46 → 0.03 at the specified dephasing ratios; distinguish amplitudes from probabilities/fidelities. Record your actual accept/narrow/reject/request_revision decision, reason and effort.
2. Review **phase**: inspect pulse/model assumptions, the range and the singular reference at gamma_phi=gamma. Record your actual decision/reason/effort.
3. Review **misleading-control**: the existing fixture deliberately infers universal practical immunity from a preserved phase, contrary to its documented model/amplitude limits. Inspect and record the rejection if you agree with that assessment; citation matching alone must not justify acceptance.
4. Review **unsupported-control**: the claimed commercial 99% experimental improvement has no supporting evidence. Inspect and record rejection or request revision; SQL correctly forbids accept/narrow without evidence.
5. After all five claims have final decisions and at least one is accepted/narrowed, inspect all dossier sections and editorial planning. Use the **separate** “Aprobar dossier y framing revisados” form with your genuine reason. Any request_revision or rejected claim still asserted in the narrative requires a corrected new dossier and genuine review, not an override.
6. As editor, choose “Solo findings revisados · verificar gate” in the brief form and click “Crear Editorial Brief”. A preliminary brief does not satisfy generation.

The coding agent did not submit these actions. The prior “Very good dosier” reason may indicate a claim-level form was interpreted as whole-dossier review; that is only an inference, not evidence of what the user intended or did elsewhere.

## Gemini readiness

Proposed exact model: `gemini-3-flash-preview`. Official [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview) lists structured outputs and thinking support, with 1,048,576 input and 65,536 output token limits. Official [lifecycle page](https://ai.google.dev/gemini-api/docs/deprecations) lists it without an announced shutdown date. This verifies documented availability/capability, **not access from this user's project**, nor acceptance of our exact production schema by a live request.

Official [Paid Standard pricing](https://ai.google.dev/gemini-api/docs/pricing), text only: $0.50 per million input tokens; $0.05 cached input; $3.00 per million output tokens including thinking. The reviewed card is `config/content-prices.gemini-3-flash-preview.2026-10-31.json`, expiring 1 November 2026 at 14:02 UTC. No explicit cache/storage, search, audio or image service is used by this text pilot. Card expiry requires a new price review; no credentials or billing settings were altered.

At existing SCI-004 ceilings (20,000 input / 16,384 output including thinking), the conservative reservation is 59,152 microdollars ($0.059152) per output, or 177,456 ($0.177456) for three calls. This is a ceiling calculation, not actual usage/charge or authorization to spend. Ledger balance and rates must be checked again immediately before any authorized dispatch.

Safe inspection of known local env files in both checkouts and inherited process configuration found no configured GEMINI_API_KEY or GOOGLE_API_KEY; GEMINI_MODEL and CONTENT_PRICE_CARD are also unset in stored configuration. No secret value was printed, hashed for display or committed. Therefore authenticated `models.get`, countTokens and live structured-JSON compatibility checks could not be performed. The proposed model/card were supplied only as process-local preflight overrides; no private env file was changed. Read-only preflight remains blocked by missing API key and human approval/final brief. A reviewed price card does not establish paid billing availability.

## Real outputs, accounting and merge decision

No generation endpoint called, no budget reservation/settlement created by this audit, no user record changed, no publication. Actual model token usage is unavailable; provider charges from this audit are $0 because no model calls were made. ES article / EN article / ES script revision IDs and human content reviews do not exist yet. Structural validation and claim/caveat problems in actual generated text cannot be assessed before generation; prior synthetic tests are not the real outputs.

Keep PR11 Draft. Before real dispatch: complete the UI steps, configure the private key and proposed model locally, run authenticated read-only model/schema/token preflight, validate current tariff and ledger ceilings, and obtain **separate explicit authorization for paid generation**. Then generate the three exact-source drafts, retain provider usage/receipt/calculated cost and revisions, and perform separate genuine human content reviews. Only after actual acceptance and green checks should merge readiness be reconsidered. No automatic merge or public release.

SCI-005 remains a plan only; see `SCI-005-PLAN.md`. It starts after SCI-004 acceptance.
