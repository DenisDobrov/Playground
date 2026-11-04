# SCI-004 real pilot reconciliation and acceptance

## Current continuation — 4 November 2026

**PR11 stays Draft; no real output generated.** PROD-002 is no longer a dependency. Owner explicitly remains editor and may perform scientific source-meaning and editorial/content review of agent-authored drafts. Existing role/permissions, author-separation and scientific evidence requirements are unchanged. Independent scientific verification remains **not_performed**; no fake reviewer or human decision has been introduced.

### Persisted facts, independently rechecked

Local read-only audit **2026-11-04T10:14:33.257Z / 13:14:33 Nairobi** confirms the same dossier/document/hash listed below. Exactly one local dossier revision and one source document exist for this Story. `model` has one genuine accept review, `fefac5fb-8c51-4579-829a-5442def20eaf`, v1, owner local editor `7e8a841d-8ebe-4606-ac8c-3d9027f4daaa`, saved **31 October 13:07:21.125 UTC**, reason “Very good dosier”, effort 10 seconds. It matches the current input hash. amplitude, phase, misleading-control and unsupported-control have **no review history**. No whole-dossier approval, preliminary/final Brief or content draft exists. Gate: accepted=1, missing=4, stale=false, claimsReady=false, ready=false. There is no stale-hash defect to fix or lost-decision history to assert.

Read-only production query **10:20:13.133 UTC** finds neither this dossier UUID nor a dossier for this exact Story. Production has 014 installed but **013 absent**. Thus the actionable pilot is local, not dobrov.org; no cloud migration or account change is needed. Both checkouts' existing local worker/web config target the same 563xx Academy. Original PDF hash on disk matches the stored checksum. Exported evidence IDs/locations match PDF p.1 Model and p.3 Eq.(4)/Fig.3; exact quote matching is not independent verification. All 13 current narrative sections contain no asserted control references.

Detailed owner walkthrough: [SCI-004-OWNER-REVIEW.md](SCI-004-OWNER-REVIEW.md). Local SCI-004 web was started at port 3000 using the existing ignored `.env.local-web`; host login HTTP 200 verified. No browser secrets or review commands were used by the agent.

### Gemini preparation and budget

Keep existing Google project **gen-lang-client-0531547795 / Dobrov Academy**. Do not create a project, change OPS-003 or enable billing. The project's last supplied billing-disabled evidence is from 2 November; this audit lacks authenticated Google project/Billing access and cannot declare that historical observation a fresh live check. No gcloud CLI or appropriate connected project-management tool is available. Owner must verify project/key association and Free/Billing disabled in AI Studio/Cloud Console. A `models.get` response alone cannot establish key-to-project identity or billing status.

Official references rechecked on 4 November: [model](https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview), [lifecycle](https://ai.google.dev/gemini-api/docs/deprecations), [structured JSON](https://ai.google.dev/gemini-api/docs/structured-output), [Paid Standard prices](https://ai.google.dev/gemini-api/docs/pricing). Existing candidate **gemini-3-flash-preview** remains documented with structured output/thinking support and no announced shutdown. It is now described as a legacy Flash model; **gemini-3.8-flash** is another documented text candidate, not automatically selected or treated as available to this key. Text article/script generation remains distinct from video/TTS generation.

New card: `config/content-prices.gemini-3-flash-preview.2026-11-04.json`, reviewed **10:18:25 UTC**, expires **5 November 10:18:25 UTC**. Paid Standard text: input $0.50/M, cached input $0.05/M, output including thinking $3/M. This card validates the existing contract and does not authorize dispatch, establish billing, or silently treat free-tier usage as paid/free. At 20,000 input and 16,384 output+thinking ceiling: **59,152 microdollars/output**, **177,456 microdollars ($0.177456) for all three outputs**. This is a reservation calculation, not actual usage/invoice or spending approval.

Prepared ignored SCI-004 worktree `.env.local`: blank GEMINI_API_KEY, model and the reviewed card path; no cloud Supabase credentials copied there. Existing `.env.local-worker` still supplies only local Academy. `git check-ignore` confirms private env files are ignored. Owner should place an existing key from the selected Google project in that local file and never send it through chat. Restrict it to Generative Language API; verify actual key/service-account permissions through the owner's console, without creating broad Owner/Editor grants. Do not add Gemini credentials to Vercel or the synthetic-only Render worker.

New `npm run gemini:readiness` makes only a bounded fixed-host **GET models/{model}**, never generateContent, countTokens, billing mutations, retries or paid calls; headers are private, metadata output is selected/redacted. Current run **10:18:55.865 UTC**: key missing, metadata requests=0, price valid, generation requests=0, billing changes=0. Exact live schema compatibility and project API access remain BLOCKED until credentials are supplied; documented structured output is not a completed live generation-schema test.

Current local ledger check at **10:14:34.786 UTC** reports **no November budget period**. The old October period is insufficient. Before separately authorized dispatch, initialize/verify the current local period using the existing reviewed plan (example: total $200, content $50, per Story $10, per video $25) and recheck available reservations/uncertain operations. Do not initialize an inferred or altered plan during this read-only reconciliation. Alerts and public list prices do not establish a hard project spending cap. Paid generation and any paid billing activation require separate explicit approval after the genuine evidence package is ready.

### Exact next owner actions

1. Review/save amplitude, phase and both controls in the local UI using the original PDF and actual effort/reasons. Reassess model if needed; do not assume its accept is whole-dossier approval.
2. Only after scientific requirements pass, personally approve the whole dossier/framing and create **nonpreliminary** Brief. The agent will recheck current review IDs and hashes; it does not submit human decisions.
3. Add the existing project's API key to the prepared ignored local file; confirm the selected project and billing-disabled/Free state. The agent can then verify metadata access with GET only. Do not enable paid billing yet.
4. Once gate/Brief/API/valid prices/current ledger pass, review the exact ES article + EN article + Spanish scene-script plan and explicitly authorize the bounded text run and any required billing activation separately. No video generation, TTS, MP4 or public publishing is included.
5. Personally review each immutable generated revision for claim mapping, caveats, quantities, citations and language. These approvals bind exact revisions and never imply publication or independent scientific verification.

No actual draft IDs, model token usage or provider charges are available: generation requests **0**. Future report must include requested/returned model, input/output/thinking/cache tokens, immutable receipt and output IDs/hashes, calculated tariff charges, structural/claim/caveat/language findings and separate human-review states. Unsupported/rejected claims must never enter generated assertions. Any uncertain call retains its ledger reservation and stops automatic replay. Keep PR11 Draft until real-paper acceptance and required tests pass; **do not merge**. Migration 013 remains local only.

### Validation for this continuation

Typecheck passed; all **115 unit tests** passed, including four new metadata-only boundary tests. Demo passed with no paid calls. Production build passed in a disposable network-disabled Docker container, using a writable build user; the first test-harness attempt as the worker image's non-root user could not create `.next`, so that isolated build was repeated with container-local write permission. Worker Dockerfile/runtime user and Production were not changed. The active local review server and database were not stopped or rebuilt.

Final read-only preflight **10:26:52.375 UTC**: accepted=1, missing=4, stale=false, no approved Brief; modelConfigured=true, reviewedPricesConfigured=true, apiKeyConfigured=false, currentBudgetConfigured=false. Gemini readiness **10:26:53.353 UTC** validates the new card but makes zero metadata/generation/token-count calls because key is absent. Local data preserved; no content-generation/review/publication RPC was executed by the agent. Full new-head CI status must be checked separately after push; prior green CI is not current acceptance evidence.

## Historical reconciliation — 31 October 2026

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
