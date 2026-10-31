# VIDEO-001 — Hybrid video: contracts and 2D fallback

Accepted technical baseline, 31 October 2026. Supersedes the presenter-free format and requirement for a published web article **only** as explicitly agreed by the owner. The ES pilot remains one 6–8 minute evidence-first video per week. No new cloud service or paid provider is selected.

## Release and source boundary

Two supported source contracts: the existing exact published article/dossier snapshot; or an independently reviewed dossier plus a nonpreliminary, human-approved editorial brief. The latter does not require a web article. `dossierVideoPublicationIssues` retains claim evidence/status, independent verification, Spanish alignment, licensed visual/audio assets and exact script/source/MP4 approvals. Bibliographic verification alone cannot satisfy it.

These are pure typed checks, not an authenticated publisher. A future server-side adapter must load persisted review IDs, actor membership and immutable revisions itself; client-supplied approval objects are never authority. No database schema, Auth, live storage or production configuration changes in VIDEO-001. SCI-003 human acceptance of the real pilot is still pending. No human approvals in fixtures represent that acceptance.

## Scene and asset contracts

`packages/video/src/hybrid.ts` defines scientific diagram, research evidence, concept visualization, optional presenter insert and scientific caveat scenes. Each binds script/claims/caveats, exact visual/audio revisions, timings, input/output hashes and separate scientific/visual review. Substantial caveats need a dedicated caveat scene. Presenter inserts are limited to eight seconds and cannot carry unique claims or required caveats: disabling them leaves the scientific explanation intact. Explanatory visualization and synthetic likeness require disclosure.

Private, immutable media revisions bind original source hashes, ownership, rights/license/attribution, scoped consent, generator model/parameter/input provenance, generated output checksum and human approval. Source photo/recording approval binds its bytes; generated segments need separate exact-output approval. Consent binds owner, original file, script revision, permitted mode and validity/revocation; it grants neither training nor unrelated reuse. Personal voice cloning requires its own explicit use permission. No personal image, recording or consent has been supplied or generated in this slice.

Voice revision contracts bind ES locale, licensed voice, pronunciation dictionary version, script/text/audio hashes, actual duration and provider receipt/cost. Pilot gate requires per-scene audio and matching measured timing. TTS execution and cloning are absent.

## Cache and deterministic fallback

Scene keys include local narration, relevant claim IDs/fingerprints/caveats, resolved media provenance, voice configuration and renderer/style/font versions. Claim fingerprints must cover claim text/status/limitations and located evidence including document version/checksum, not just claim IDs. Global revision IDs and assembly order do not force unrelated clips to rerender. Source/script changes still invalidate **final** approvals; assembly order changes assembly identity. Cache reuse requires matching input hash and actual output bytes. Rights/consent must be revalidated even on cache hits.

`pan-fallback.ts` renders an approved still with bounded center zoom (up to 1.08), at most eight seconds, H264/yuv420p, no audio. It validates source bytes and hashes the FFmpeg executable into cache identity. PNG/JPEG/binary PPM/WebP signatures select a fixed image decoder; rendering uses a private temporary copy of validated bytes, not the mutable source path or a media playlist. Local file/pipe protocols only; no shell execution; timeout, frame/dimension and allocation bounds. Exclusive local lock, temporary output and immutable manifest prevent accidental overwrite. Corrupted/incomplete cache is held for operator inspection; do not blindly delete a live lock. Production retries must reuse existing Postgres worker lease/heartbeat, not treat this local lock as distributed orchestration.

The fallback does not manufacture lip sync or a recorded statement. No vendor is called by the `PresenterAnimationProvider` interface. A failed optional animation may use an approved still after fresh rights/consent checks; no approved still means omit the insert. Both paths require subsequent visual review.

## Reproduce the offline smoke

Install trusted local FFmpeg and ffprobe, then in PowerShell:

```powershell
$env:FFMPEG_PATH = 'C:\absolute\path\ffmpeg.exe'
$env:FFPROBE_PATH = 'C:\absolute\path\ffprobe.exe'
npm run video:hybrid:preview
```

The CLI creates an original non-person grid card, renders three silent seconds at 1920×1080/30 fps, verifies H264/dimensions/duration/no audio with ffprobe, repeats to check checksum-backed cache reuse and writes `artifacts/hybrid-preview/report.json` plus an ES technical SRT. All artifacts are ignored. This is not the real scientific pilot, presenter approval, TTS, AAC mux or audiovisual QA. Provider cost is zero; CPU/storage costs are not estimated as zero.

## Next slices

1. Complete real SCI-003 human scientific review and approve the editorial brief; prepare evidence-bound ES/EN drafts and ES script, then obtain script/language approval.
2. Add licensed ES TTS and versioned pronunciation dictionary with actual-duration timeline. Use existing ledger reserve/start/settle and provider ceilings, including uncertain bills; no paid research benchmark needed.
3. Implement Remotion/React/SVG scientific/evidence/caveat scenes and FFmpeg assembly, captions and audiovisual QA. Check the applicable renderer license before execution. Store private assets/revisions and approvals through existing authenticated storage/repository patterns.
4. Optional consented owner inserts through a bounded provider adapter, or approved still fallback. No vendor cost/quality assumptions; compare only when authorized assets and budget exist.
5. Exact MP4 human review, private YouTube upload with explicit OAuth setup, then separately authorized public release. Private upload never grants public-release approval.

Reuse existing four budget categories: content tools → content, TTS → voice, animation/visual generation/render → video; retain precise tool names and receipt metadata. No new category migration or automatic paid retries. Reuse existing Source/Story, dossiers, queue, ledger, Auth and private bucket; durable hybrid scene persistence and orchestration remain follow-up work, not claimed complete here.
