# NEWS-004 — robotics preparation and editable YouTube links

Owner request, 15 November 2026: prepare missing GR00T 2, Gemini Robotics 2.5 and GXO/Digit stories in four languages; mark all three as owner-selected video candidates; allow editors to attach an already published YouTube video without republishing articles. No new video production, scripts, uploads or marketing.

## Existing state and contract

Production preflight found 46 Stories, 48 news packages and 126 language release snapshots. The three individual robotics events are absent; the physical-AI overview is a separate prepared analysis and TeCoBot is already published in four languages. Reused background sources must not merge those events. Retain the existing NEWS-003 research dossier, agent source-meaning check, brief, translations and exact-package owner decision. Preparation is not release authorization.

The old video reader is a code-bound, exact-package association for the finished chatbot-context video. Preserve that association until an editor explicitly changes or removes it. A removed link must never reappear through the legacy fallback.

## Small compatible metadata extension

Migration 017 adds optional YouTube ID/language, an explicit override marker and a separate media version to existing news_state. It adds one append-only metadata audit table, an editor-only media RPC and a narrow public projection limited to Stories with actually published release snapshots. No new video-management system, changes to immutable article/research packages, publication rows, roles or Auth settings.

URL normalization accepts exact YouTube hosts and supported video paths; storage accepts only an 11-character video ID. Rendering constructs an HTTPS watch link locally, without contacting YouTube. A shared ID can appear on any number of Stories. Unknown video language is allowed. No assigned ID means no public control. Generic links are placed near the introduction; the historical player remains scoped to its original exact package.

Media edits use authenticated editor membership, optimistic media version and actor/input-bound request IDs. They append before/after audit records while leaving publication decisions, article dates, canonical URLs, translations and scientific review untouched. The UI has a separate save/remove form, not a publication action.

The explicit owner candidate instruction is recorded separately from AI suggestions and publication decisions: update the existing suggested_video field, retain science/comment/decision, mark owner_set and append a metadata event tied to the exact original instruction hash. This does not impersonate an editor UI click or authorize article release. Associate the three briefs with the existing physical-AI concept by canonical Story ID in the existing brief text; do not create another concept workflow.

## Acceptance and rollout

Run typecheck, unit tests, demo and build; local DB tests cover editor/reviewer/outsider/anon access, add/replace/remove, replay/conflict, shared video IDs, draft privacy, legacy removal and unchanged release/approval history. Built-web tests cover four labels, English-language notice, no empty control, safe normalization and unchanged SEO/routes.

Before cloud migration: Academy-only backup, isolated verified restore, local rehearsal, installed migration checksums and preserved legacy schema/ACLs. Apply only 017; never reset the shared database or apply unrelated migration 013. Deploy the reviewed build, then inspect authenticated cards and public pages. Real publication requires the existing owner decision. Record deployed versus prepared status and actual checks in private receipts.

## Verification, 15 November 2026

Passed locally: 225 unit tests; typecheck, demo and production build; NEWS-001, NEWS-003 and NEWS-004 database integration; built editorial HTTP add/remove, CSRF and role checks with unchanged releases; 22 four-language HTTP checks; SEO HTTP checks. A 51-table Academy backup was restored with matching fingerprints and 017 was rehearsed on the isolated copy. New private intake subsequently changed the cloud data, so take a fresh backup before applying.

Prepared canonical Stories: R01 `57217bc4-1cd9-4e5b-9ab2-913bf128f28e`, R02 `a8a873ea-d21f-4195-b69d-b3a7d6bb190a`, R03 `542fbaf1-7867-49ea-8823-2e7a3e57a074`. Authenticated UI inspection confirmed all 12 translations and all three checked flags in Video Ideas. Source checks are agent checks with documented limitations; no independent reproduction. Exact-package human decisions remain pending. Candidate provenance must still be recorded with `news-robotics-flags.mjs` after 017 is installed.

Automatic permission review rejected the production migration as lacking specific cloud-schema approval. The owner has been asked to approve exact migration 017; deployment remains held while that answer is pending. No production DDL was executed. New article import preserved 130 existing releases and 45 decisions; no publication call was made.
