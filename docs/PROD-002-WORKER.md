# PROD-002 — Render worker approval package

Prepared 4 November 2026. **NOT PROVISIONED; production lifecycle BLOCKED pending approval.**
Production web remains PR16 / `7bb34a9542754e06c3b623140d4a4cc05f48fa7f`, Vercel `dpl_DEw4ExvpNxNWgLnBc2T2N7EUnYK2`.
PR11 remains open Draft. OPS-003, memberships, Auth settings, Gemini billing and public publishing are unchanged.

## Read-only production evidence

At **2026-11-04 09:18:12.442 UTC / 12:18:12.442 Africa/Nairobi**, verified-TLS `BEGIN READ ONLY` audit of the selected Academy project found:
- One `normalize_source` job, succeeded, attempts=1, created 22 October 2026 05:48:12.293 UTC.
- Zero queued jobs, zero running jobs, zero active leases. No new acceptance job was enqueued.
- Existing editor role unchanged; no reviewer. Anonymous Academy reads denied; private bucket unchanged.
- Production migrations 001–012. No 013/SCI-004 or 014 acceptance migration installed.

Private evidence stays in the main checkout's ignored `artifacts/domain-001/prod002-final-audit.json`.
`git ls-remote` confirms production master `7bb34a9`; `gh pr view 11` confirms OPEN/isDraft=true.

## Required isolation correction

Existing `claim_job()` selects globally and also marks unrelated exhausted jobs failed. An empty-queue precheck cannot protect against concurrent editorial enqueue. Checking the returned job in JavaScript after committing the global claim is insufficient.

Prepared additive migration **202611040014_worker_acceptance.sql** creates a service-role-only scoped claim, without replacing existing RPCs or changing user roles/grants. It requires all of:
- Key `prod002:worker:normalize:v1`.
- Stage `normalize_source`, `story_id IS NULL`.
- Exact payload `{"identifier":"doi:10.9999/academy-prod002-worker-acceptance","synthetic":true,"doNotPublish":true}`.
- Due/expired status and remaining attempts, atomically protected by `FOR UPDATE SKIP LOCKED`.

It never performs global exhausted-job cleanup and never falls back to the normal claim. Unknown or unavailable scoped RPC fails closed. The existing one-shot handler, lease renewal, finish, fail and dedupe implementation are reused. Acceptance mode explicitly renews once after claiming and emits job ID/attempt/timestamp events, never lease tokens or payloads. The handler only normalizes the synthetic identifier: no external source fetching, research mutation, paid calls or video.

**Approval must explicitly include installation of only migration 014 and its install-journal entry after a fresh backup/checksum check.** Do not use an indiscriminate migration-up command or install PR11/013. The isolated script must preserve existing 001–012 checksums and all records. This SQL has only been exercised inside a rolled-back local transaction; no local user records were modified.

## Exact proposed Render configuration

| Field | Value |
|---|---|
| Service | One Cron Job: `dobrov-academy-worker-prod` |
| Repository | `https://github.com/DenisDobrov/Playground` |
| Branch/revision | `codex/prod-002-worker-preparation`; approve the exact preparation commit, deploy it explicitly, then verify Render reports that SHA |
| Auto deploy | Disabled; no PR previews, no automatic branch updates |
| Runtime | Docker, existing `apps/worker/Dockerfile` |
| Docker context | Repository root `.`; no root-directory override |
| Local build equivalent | `docker build -f apps/worker/Dockerfile -t dobrov-worker:prod002-prepared .` |
| Region | Ohio (`ohio`), matching existing Supabase region; confirm availability during creation, do not silently substitute |
| Plan | `0.5c-512mb` (legacy Starter): 0.5 CPU, 512 MB RAM |
| Schedule | `*/15 * * * *`, UTC |
| Custom Docker Command | `timeout --signal=TERM --kill-after=10s 240s env WORKER_QUEUE_MODE=acceptance npm run worker:once` |
| Concurrency | Render single-run guarantee plus database leases; no manual trigger while a run is active |
| Disk/HTTP | None, no persistent disk, no web endpoint |

Dockerfile uses Node 24 Bookworm slim, installs the locked workspace dependencies and existing FFmpeg dependency, runs as `node`, default CMD `npm run worker:once`. Installing FFmpeg does not run rendering. `.dockerignore` excludes `.env*`, `.enм`, certificates, artifacts, Git and local build directories. No secrets as Docker build arguments, no shared environment group.

Schedule may run before manual acceptance enqueue; scoped mode then returns `worker.idle`. After successful acceptance the same key remains terminal and later runs idle. **General research queue processing is not approved by this acceptance-only rollout.** Switching to normal queue consumption requires a separate explicit operational decision; this avoids accidentally handling unrelated pending work.

## Worker-only environment

| Variable | Handling |
|---|---|
| `SUPABASE_URL` | Exact existing `https://upwrplsgunjanragbggb.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Private runtime secret transferred only after approval; never copied into the repository/chat/logs |
| `SUPABASE_DB_SCHEMA` | `academy` |
| `WORKER_QUEUE_MODE` | `acceptance`; also forced in the Docker Command |
| `NODE_ENV` | `production` at runtime; locked build must retain dev tooling `tsx` |

No database password/DB URL/CA, browser Auth material, signing key, Gemini/OpenAI/Anthropic/TTS/YouTube/Render API key is supplied to the worker. The Supabase service-role key is project-wide and shared with the legacy application; schema selection does not reduce the credential's underlying authority. Approval therefore includes transfer of this existing administrative credential to Render. Never rotate a shared key as routine rollback. No AI credentials plus scoped normalization means no AI provider access through this deployment; it is not a claimed network firewall.

Private local configuration check confirms the exact selected URL, a nonempty service-role key and schema academy, without outputting the key. This is presence/target validation, not a fresh worker authentication claim; actual API authentication is part of the approved hosted test.

## Current pricing and cost controls

Checked 4 November 2026 against [Render pricing](https://render.com/pricing?trk=article-ssr-frontend-pulse_little-text-block), [cron documentation](https://render.com/docs/cronjobs) and [compute plans](https://render.com/docs/compute-plans): smallest cron $0.00016/minute; billed by active seconds; **$1 minimum per cron service/month**. No paid workspace upgrade is proposed; confirm the chosen account supports this before purchase.

- 30-day month: 2,880 invocations. One billed minute each => $0.4608 usage, so $1 minimum.
- 31-day month: 2,976 invocations. At the enforced 250-second termination ceiling each => approximately **$1.984 compute**, excluding startup/termination overhead not covered by the command, extra manual runs, builds, network, storage quotas and taxes. This is not a guaranteed invoice ceiling.
- Proposed compute spending envelope: **$3/month for this one service**. Do not auto-upgrade RAM/CPU or add another service. Review actual runtime/compute after the controlled run and first day; stop on unexpected usage or repeated failures. Account billing alerts, if available, are notifications, not a hard cap. No claim of a verified account-specific hard cap.
- Disable automatic deployments; keep manual runs bounded; no render/model keys, feed poller or retry loop. Expected normal job takes seconds, but actual Render cold-start billing remains unmeasured.

## Post-approval production test procedure

1. Fresh read-only queue, checksums and production web revision audit. Back up affected Academy definitions/journal and inspect only the dedicated synthetic key for collisions. Preserve real records. Install only approved 014, with no Auth changes.
2. Create the single service with scoped mode and pinned preparation SHA; confirm service/deploy IDs, reported SHA, command, schedule and secret names without reading values back. Capture first idle run and exit code.
3. Enqueue exactly `normalize_source` / `prod002:worker:normalize:v1` / exact synthetic payload / null Story. Capture returned job UUID and UTC timestamps. A repeat enqueue with the same key must return that same UUID and must not alter the payload.
4. Trigger one run only when no run is active. Capture `job.claimed`, attempt=1, `job.lease_renewed`, `job.succeeded`, provider run/deployment IDs and timestamps. Independently SELECT the dedicated queue row: succeeded, attempts=1, exact canonical result, leases cleared. Compare pre/post unrelated queue rows; none may change.
5. Repeat the same enqueue and next controlled run: same job UUID, `worker.idle`, attempts unchanged, identical persisted result. Do not reset or delete the successful job to fake idempotency.
6. Retain the local SQL evidence for retry/backoff/wrong-lease protection. For a hosted fail-closed diagnostic, separately run the same pinned image with credentials absent and networking disabled if Render supports a bounded one-off override; otherwise mark hosted fault injection BLOCKED rather than alter shared secrets or research jobs. Do not count local failure tests as hosted failure evidence. No deliberate failure on real records.
7. Save redacted lifecycle evidence and actual invoice/running-time estimate. Mark each acceptance criterion independently. Do not declare general worker readiness or change web readiness until scheduled operation is evidenced; existing private readiness remains worker=unverified without a heartbeat protocol.

## Rollback

Suspend scheduling first. Cancel an active run only after recording its job ID; a killed process may leave its synthetic lease until the existing 10-minute expiry. Do not clear leases or replay success manually. Remove the Render runtime secret; delete the cron service if abandoned (suspension alone is not a promised billing cancellation). Keep synthetic job history and existing queue records. The additive scoped RPC may remain unused; dropping only it/journal correction requires an explicit reviewed rollback and must not touch global RPCs. No web deploy or shared Auth/role/key change is needed. Existing production web remains stable throughout.

## Verification and remaining boundaries

- Existing Docker image built locally; prepared image rebuilt with scoped routing. Credential-free/network-disabled startup exits 1 with generic `worker.failed`, without trying the queue.
- 20 scoped SQL assertions pass in a rolled-back local transaction, including unchanged unrelated/exhausted rows, wrong payload/stage denial, duplicate claim/enqueue, lease renewal, stale lease denial, success, retry/backoff.
- Existing queue (12 assertions) and production-budget (28 assertions) SQL regressions also passed locally inside their rolled-back transactions; no billed calls.
- Final unit suite: **110 passed**, typecheck passed. Demo and production web build passed; no web files changed. Exact Docker Command passed in a network-disabled Linux container against a synthetic HTTP server: scoped claim, explicit renewal, finish, repeat idle and unavailable-RPC exit 1, with no global fallback and no secret/lease-token output. This is local transport evidence, not a hosted production job.
- No Render account/service inspected or provisioned; account access and exact billing checkout remain prerequisites. No hosted lifecycle PASS is claimed.
- Natural production session expiry remains pending passive owner observation. No session secret extracted and no Auth setting changed. Reviewer test remains BLOCKED by owner decision; sole editor stays editor.
