# DEMO-001 — private synthetic content-to-video demonstration

Tracking: [Issue #17](https://github.com/DenisDobrov/Playground/issues/17). Separate branch `codex/demo-001-media`, based on master `7bb34a9`. SCI-004 PR #11 remains separate and Draft. No database, Auth, cloud, production worker, public web or publishing changes.

## Scope and implementation matrix

| Dependency | Existing capability | DEMO-001 execution / remaining boundary |
|---|---|---|
| SCI-004 PR11 | Typed bilingual article and Spanish scene-script schemas; real evidence/review and paid-call gates | Emit structurally compatible JSON and validate read-only against actual PR11 schemas. No fake approved ContentInput; no real-paper gate bypass. |
| VIDEO-001 hybrid | Scene/assets/voice contracts, exact hashes, caveat coverage, technical-preview planning | Use `planHybridVideo` and `hybridReleaseIssues`; human approvals remain absent and release blocked. |
| FFmpeg fallback | Validated still image, binary-hash cache, lock, bounded pan <=8s | Execute for 14 landscape scenes; pad to actual narration timing and add AAC/subtitles. Dedicated bounded portrait compositor for three scenes; original fallback limits unchanged. |
| Branding | Approved original mark, Ink/Blue/Paper palette | Inline original SVG mark; create original chart SVGs and six social formats. No likeness or external image rights. |
| Spanish narration | Voice revision contract, no executing TTS in master | Local eSpeak NG default Spanish formant voice, explicit pronunciation dictionary; measured WAV/chunk durations, AAC, SRT/ASS. No cloning or remote provider. |
| Remotion | No executable installation/configuration in this base | NOT STARTED; not required for deterministic SVG/FFmpeg demo. Evaluate separately for scene templates after owner audiovisual feedback. |
| Production budget | Atomic reserve/start/settle with uncertain-bill retention | No external calls or spend in this demo. Record local receipts and $0 external API charges; local CPU/storage are not claimed to be costless. Live provider integration must use the existing ledger. |
| Supabase worker | Bounded jobs and production queue/RLS separation | No enqueue or queue changes. CLI only. Future integration must use dedicated authorized job types and existing leases/idempotency. |
| Editorial UI/Auth | Real local research review on port3000, separate public demo | Leave untouched. Dedicated loopback-only file viewer on3150, no cloud or session secrets. |

## Inputs and outputs

`tools/demo/fixture.ts` defines invented halving sequences A=[100,50,25,12.5,6.25], B=[40,20,10,5,2.5]. Normalizing by the initial value produces identical relative curves. This is arithmetic, **not a scientific finding**. Original local source URN, three typed synthetic claim IDs and three explicit caveats accompany paragraphs/scenes. No real publication/citation or scientific approval is invented.

Articles have the eight SCI-004 sections in ES and EN; script uses VIDEO-001 scene types. Short duration is a technical-preview requirement, not a relaxation of the separate real 6–8 minute pilot gate. No presenter scenes or unique presenter claims exist.

Output under ignored `artifacts/demo-001/revisions/<SHA256>/`:

- `article-es/en.json` and `.md`; `script-es.json`; `storyboard.json` with claim/caveat maps, asset rights and hashes.
- `visuals/*.svg/png`, original absolute/relative charts in both orientations; per-scene WAVs; full `narration-es.wav`, `voice-revision.json`.
- `main.mp4` 1920×1080, H264/AAC, 116.08s; `short.mp4` 1080×1920, H264/AAC, 25.00s; burned Spanish captions plus separate SRTs.
- YouTube1280×720, OG1200×630, Instagram1080×1080/1080×1350, LinkedIn1200×627 and X1200×675 SVG/PNG.
- `social-drafts.json`: ES/EN copy for YouTube, LinkedIn, X, Instagram, Threads, Facebook, Telegram, future WhatsApp Channel and newsletter; YouTube chapter timestamps/tags/thumbnail. All NOT SCHEDULED / NOT PUBLISHED / NOT UPLOADED.
- `index.html` private review dashboard; `manifest.json`, `toolchain.json`, `execution.json`, `qa.json`, ffprobe/audio evidence, frames and license notices; `OWNER-REVIEW.md`.

The full revision hash binds fixture, articles, narration, pronunciation dictionary, renderer source hashes, lockfile, executable identities, voice data and fonts. Actual checksums are recorded in the manifest; media must never be changed in place.

## Reproduce locally

Requires Docker Desktop with Linux containers. No credentials or environment files passed. From this checkout in PowerShell:

```powershell
docker build -f tools/demo/Dockerfile -t dobrov-demo:demo001 .
New-Item -ItemType Directory -Force artifacts/demo-001 | Out-Null
$demoOutput = Join-Path (Get-Location) 'artifacts/demo-001'
docker run --rm --network none --cpus 2 --memory 2g --mount "type=bind,source=$demoOutput,target=/out" dobrov-demo:demo001 --out=/out
node tools/demo/verify.mjs artifacts/demo-001 --viewer
node tools/demo/serve.mjs artifacts/demo-001 3150
```

For verify, optional second positional argument is a 64-character revision hash; `--viewer` additionally runs real local HTTP/privacy/range checks against a temporary viewer on3151.

Open `http://127.0.0.1:3150`. It listens only on loopback, rejects foreign Host/POST/path escapes, emits noindex/no-store/CSP, supports MP4 byte ranges and serves no directory listing. It has no user authentication and is suitable only for local private synthetic artifacts. Do not expose or tunnel it publicly.

Recovery: add `--fail-after=audio` on a fresh revision, then rerun unchanged. A complete revision replay verifies every output hash and performs no synthesis/rendering. `--variant=visual-detail` changes only the rule-scene illustration; other narration and scene caches must be reused. Restore the base viewer target by rerunning without the variant. Cache corruption fails closed; do not erase unknown locks or incomplete artifacts to force success. Run the tamper probe against an isolated copy:

```powershell
docker run --rm --network none --mount "type=bind,source=$demoOutput,target=/out" --entrypoint node_modules/.bin/tsx dobrov-demo:demo001 tools/demo/cache-probe.ts /out
```

Single operator/CLI invocation only; not a concurrent production scheduler. The existing pan lock is preserved; the new demo mux/audio cache does not claim distributed job lease protection. A crash leaving an incomplete cache requires inspection. Old unsuccessful/partial revisions remain private for audit. A different Docker rebuild may install newer Debian packages: toolchain hashes force a new revision. Preserve the built image/digest for exact replay; do not claim apt dependencies are pinned forever.

## QA, licensing and limitations

Actual QA decodes both MP4s, checks H264/AAC/yuv420p/dimensions/durations, non-silent/unclipped measured audio, long silences, black segments, audio/video drift, ordered/in-bounds subtitle timings and byte hashes. Subtitles use measured synthesized chunk boundaries and frame-aligned scene offsets, **not word-level forced alignment**. Speech intelligibility, naturalness and semantic alignment still require owner listening/watching. Formant synthesis is robotic and is not a selected production voice.

eSpeak NG 1.51 is GPL-3.0-or-later software; use default Spanish formant synthesis on original narration. No sampled personal voice/clone/model weights are introduced. Its Debian copyright notice and DejaVu font license are copied into the private artifact package. Software notices govern redistributed software; no binary redistribution is proposed here. Original graphics/text are project-owned private demonstration assets; no new public content license is granted. See [eSpeak NG](https://github.com/espeak-ng/espeak-ng), [COPYING](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING), [eSpeak license/output explanation](https://espeak.sourceforge.net/license.html). No third-party scientific figures/music/footage are used.

All human approvals are null. Mathematical consistency is separate from independent scientific verification. Technical PASS does not authorize publishing. The owner must review both videos with sound, ES/EN language, numeric meaning, caption safe areas and social copy separately. Owner review is never represented as independent scientific verification.

## Future real production integration (plan only)

1. Accept only persisted current approved SCI-004 dossier/brief/content revisions, actor-authorized at the server. Never convert this fixture into real verified evidence or import its artificial claims into Academy.
2. Bind approved Spanish narration to exact script hash; approved ES/EN drafts retain separate per-language reviews. Owner may review in the authorized role; retain explicit `independentScientificVerification` status.
3. Reuse media/voice contracts with immutable storage refs, source rights and claim/caveat checks. Add natural TTS provider only after voice rights, actual pricing and explicit paid-call authorization; reserve/start/settle and uncertain bill handling precede dispatch.
4. Add bounded worker stages for voice, SVG/scene rendering, assembly and QA, each with leases, idempotency, immutable cache manifests and persisted output checksums. Render scene clips separately rather than exceeding bounded subprocess limits for a future6–8 minute assembly. Do not activate the general production queue for this demo.
5. Persist real human audiovisual and exact-output approval in a separate reviewed implementation. Publishing/YouTube/social adapters must enforce release gates server-side and need explicit upload/publication authorization.

No SCI-005 production implementation, production migration013, paid model/video generation, YouTube upload or public release is included. No changes to OPS-003 or PR11.
