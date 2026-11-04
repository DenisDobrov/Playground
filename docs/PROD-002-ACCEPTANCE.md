# PROD-002 — Final production acceptance, 3 November 2026

## 4 November worker continuation

PR16 has since been merged/deployed at `7bb34a9542754e06c3b623140d4a4cc05f48fa7f`. Owner-confirmed editor write/reload/logout and private database readiness passed. Reviewer remains BLOCKED by owner decision; editor role unchanged. Natural session expiry awaits passive observation. The historical sections below retain the pre-rollout baseline.

The current worker approval package is [PROD-002-WORKER.md](PROD-002-WORKER.md), with an approval-only configuration in `deploy/render-worker.approval.yaml`. No Render service or cloud migration has been created/applied. The prepared scoped acceptance RPC requires explicit approval separately from the paid service. General queue processing is not included in this proposed test rollout.

**OPEN.** SCI-004 PR11 remains Draft. OPS-003 is unchanged. No production accounts/roles, real research records, Auth settings, billing, workers or database migrations are changed by this work. Computer Use's Windows URL safety restriction is not bypassed; the remaining personal-browser checks use the owner's normal browser.

## Evidence and revision boundaries

Current observed production: Vercel `dpl_BprhchNFnU5wWnHz98Bf9ikGjKgH`, source `b421681cb9f9666584ba5c021db583567181afca` (master / PR10), Next web only, `iad1`, READY. Health fix is isolated in `codex/prod-002-acceptance`, based on that exact source; PR11 is not included. A passing branch/CI test is not evidence that production has changed.

Read-only cloud audit **2026-11-03 11:03:36 UTC / 14:03:36 Africa/Nairobi**: verified TLS connection to the selected existing Supabase project; `BEGIN READ ONLY`, then rollback. Private full evidence remains ignored at main checkout `artifacts/domain-001/prod002-final-audit.json`. It contains no browser session secrets. Production journal is 001–012, not SCI-004/013. Existing public publication code remains disabled/demo.

| Area | Current production result | Evidence / missing action |
|---|---|---|
| Authorized editor E2E | BLOCKED | One existing owner editor membership; last persisted Auth sign-in 2026-11-01 12:41:45.660 UTC. No fresh owner session confirmation or dedicated synthetic write/reload/logout/expiry run yet. Personal login is required. |
| Background worker | NOT DEPLOYED in the configured project stack; acceptance BLOCKED | Vercel inventory contains only the Next web project for this repo; repo workflows are CI checks only, no production schedule; no Academy worker container in the inspected local Docker inventory. Cloud queue has one succeeded normalize_source created 22 October and no running leases. Historical one-shot success is not a deployed service. No worker hosting environment, deployed revision or schedule is assigned. Unreported external hosting cannot be inferred from an old queue row. |
| Existing approved reviewer | BLOCKED | Fresh production membership query returned one editor and zero reviewers. No accounts or roles were created/changed. A designated existing approved reviewer session/membership is required. |
| Anonymous data containment | PASS | Production read-only role checks deny stories/dossiers/claims/evidence/editor_members/production_jobs with 42501. Academy application tables have RLS; assets bucket remains private. Fresh HTTP route checks must continue after any production deployment. |
| Current production health | FAIL | Current `/api/health` reports hardcoded demo status despite live editorial; it is not dependency readiness. Fix below is separately tested before production rollout. |

## Priority 1 — exact manual E2E, no browser secret transfer

1. In one ordinary browser/profile, open `https://dobrov.org/login`, request a fresh link for the existing editor account, and complete the email link in that same profile. Do not send login URLs, cookies, JWTs, verification codes or screenshots of them to the agent. Confirm `/editorial` and `/editorial/stories` open.
2. The dedicated identifier **`doi:10.9999/academy-prod002-20261103-acceptance`** was absent at the read-only audit. It is deliberately synthetic and not a real scientific publication. On `/editorial`, use “Añadir una fuente” with this exact identifier, title **`PROD-002 SYNTHETIC ACCEPTANCE 2026-11-03 — DO NOT PUBLISH`**, area AI, then “Añadir a la bandeja”. If it already exists, reuse that exact marked record; do not create another identifier.
3. On that record only, choose **Retener / contexto**, reason **`PROD-002 synthetic persistence check; do not publish.`**, then “Guardar decisión”. This is a technical selection test, not a scientific claim review/approval. It queues only normalization; it must not trigger publication, Gemini, video or a feed poller.
4. Reload `/editorial/stories?q=academy-prod002-20261103-acceptance`. Confirm the exact title/held status/reason persist. The operator separately rereads only this identifier's Source/Story/decision/version via a read-only cloud query. Both UI reload and persisted DB evidence are required for PASS; a SQL insert or direct RPC with an invented actor cannot substitute.
5. Use **Cerrar sesión**. Reopen `/editorial`, `/editorial/stories` and a prior private URL. Confirm they return to login, and the prior browser Back view does not fetch live private data. Operator verifies anonymous route denial independently. No global logout or other-session revocation is needed.
6. For session expiration, retain a signed-in test tab until the configured access-token lifetime naturally passes, then reload and confirm either legitimate refresh or a clean login redirect. Do not shorten shared Auth TTL, alter the owner's tokens/cookies, disable PKCE or extract session secrets. Existing isolated CI tests exercise expired synthetic-session refresh and logout; report that as **integration PASS**, never as an observed production expiry PASS. Missing personal expiry evidence remains BLOCKED.

Report completion as observations (editor opened / exact record saved / reload persisted / logout denied / expiry refreshed-or-denied). No credential material is required. Leave the marked record held for audit; no irreversible cleanup is required.

## Priority 2 — smallest reliable worker proposal (approval required)

**Not provisioned.** Proposed minimal deployment: one Render Cron Job using the existing Docker worker at an approved pinned commit, single-run execution every 15 minutes UTC (`*/15 * * * *`), command `timeout --signal=TERM 240s npm run worker:once`. It processes one existing free-stage queue job per invocation. Reuse Supabase Postgres enqueue/claim/lease/renew/finish/retry; no Redis, new database, HTTP worker API or GPU. No model keys or billing capability supplied. Secrets are worker-only and must not enter Vercel web or logs. Render single-run scheduling complements, not replaces, database leases.

Expected starting compute cost: **$1/month minimum** for one cron service, with usage at published smallest-instance rates (currently $0.00016/minute) billed above that if needed; build/network overages and taxes are separate. At 15-minute cadence, 2,880 monthly runs of one minute are below the $1 minimum. Cold starts/runtime must be measured; this is an estimate, not a purchased subscription or spend commitment. An always-on worker starts around $7/month and needs a supervised polling loop, so it is unnecessary for this initial queue volume.

Sources checked 3 November: [Render cron scheduling/single-run/billing](https://render.com/docs/cronjobs), [Render compute pricing](https://render.com/pricing), [Render's published compute examples](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses). Provider availability/plan/rates must be rechecked before provisioning. Obtain approval for provider, secret transfer, exact deployment revision, schedule and a monthly cap before creating a service.

After approval and deployment, pause competing producers for the controlled acceptance window and verify queue isolation. Use only the dedicated synthetic record, an idempotent normalize_source key, and record enqueue → claim/live lease → finish/succeeded/result plus execution/deployment timestamps and attempts. Re-enqueue the same key must reuse the original job without new work. Do not let a global claim consume an unrelated research job during this test. Old completed jobs or a local one-shot are not production-worker acceptance.

## Priority 3 — reviewer

An existing approved reviewer must be identified before browser tests. Currently there is no production reviewer membership to use. Do not simulate a human reviewer with service-role access, create a duplicate account, temporarily demote the owner or modify unrelated users. If the owner wishes to designate an existing Auth user, exact user/role approval is a separate required action.

With a genuine reviewer session: verify private catalog/readiness reading; intake and selection writes must fail in the server action and database. Keep scientific-review permissions scoped as in SCI-003; no real scientific review is manufactured by this acceptance test. Existing CI uses isolated synthetic role fixtures and validates these boundaries; it does not prove a production reviewer session.

## Priority 4 — health/readiness fix

- Public `GET /api/health`: dynamic, no-store, 200 for web process liveness only; `{status:"ok",checks:{web:"alive"},publicationEnabled:false}`. It performs no database/worker probe and has no hardcoded demo mode.
- Private `GET /api/readiness`: current authenticated editor/reviewer membership required. Missing/invalid session → generic 401; authenticated nonmember → generic 403; bad config/Auth outage → generic 503. Anonymous callers never receive component diagnostics.
- After authorization, bounded read-only probes use the user's own grants to test catalog, queue, metadata, primary documents and briefs. One shared five-second network deadline applies to Auth/membership/probes. No service-role key or database password is used by web. Auth may perform its ordinary cookie refresh; no application data is written.
- Authenticated report distinguishes `web: alive`, `editorialDatabase: ready|unavailable`, `worker: unverified`, and `publicationEnabled: false`. Worker remains unverified because no deployed heartbeat/attestation exists; neither an env flag nor historical queue success can manufacture readiness. Ready DB plus unverified worker returns **degraded / HTTP 503**; unavailable DB returns **unavailable / 503**. Liveness remains 200. Retry-After:60, Cookie Vary and no-store prevent stale/private readiness caching.
- No raw errors, keys, URLs, table names, identities, row counts, job payloads or internal diagnostics are returned. Unit and isolated real-Auth HTTP tests cover gates, failure states, expiry refresh, logout, privacy and publication remaining disabled.

Rollout must preserve current production: review/test the focused branch, inspect its protected preview, then explicitly approve merge/deployment of this health fix (not PR11). No migration, Auth setting or worker provisioning is required for health. Verify the production source revision and anonymous/private responses after rollout. Roll back only to the recorded immutable current deployment on unexpected regression; do not change shared Supabase settings. Until deployed and checked, production health acceptance stays FAIL/BLOCKED rather than claiming that local code changed the live endpoint.
