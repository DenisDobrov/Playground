# DEMO-001 — execution and acceptance report

4 November 2026, UTC. Technical demo: **PASS**. Owner audiovisual/language acceptance: **OWNER REVIEW REQUIRED**. Publishing/upload/scheduling: **BLOCKED**. [Runbook and production integration plan](DEMO-001.md). Tracking: [Issue17](https://github.com/DenisDobrov/Playground/issues/17).

## Exact outputs

Base revision `a663ba0ad5a79e37d412f9f42426894c3ea2804a2f7e0a6d3d7bdb3973f6b395` under ignored `artifacts/demo-001/revisions/`.

| Output | Actual profile / size | SHA-256 |
|---|---|---|
| `main.mp4` | 1920×1080,25fps,H264/yuv420p,AAC48kHz mono,116.08s;10138796 bytes | `e06cf293eb82519320771c72ca1349348ef059f4c25d33b4288982c2298585a4` |
| `short.mp4` | 1080×1920,25fps,H264/yuv420p,AAC48kHz mono,25.00s;804766 bytes | `101d9b2be530ee8c22f38e400d59c60833f3ef8bec6fdb7a911bf30b66d8c0da` |

The manifest contains checksums/sizes for124 actual output files, including two article JSON/Markdown drafts, scene script/storyboard, original landscape/portrait SVG/PNG pairs, original social images, audio, two SRTs, QA, license notices and review dashboard. The manifest does not recursively hash itself. Mutable `latest.json` points to the base revision after replay; immutable revisions were preserved.

## Independent technical checks

| Area | Result | Actual evidence |
|---|---|---|
| ES/EN articles + ES script | PASS | Three generated JSON files parsed against **actual** SCI-004 PR11 schemas at d160713, read-only,13:59:13Z. Eight sections/language, known claim IDs and mandatory caveat mappings. No approved evidence package fabricated. |
| Narration | PASS technical | eSpeak NG1.51 Spanish formant voice;14 actual segments, pronunciation dictionary es-demo/2; measured chunk/scene durations and full voice revision hash. Human intelligibility/naturalness not approved. |
| Main/short media | PASS | Full ffmpeg decode, ffprobe codec/dimensions/duration/audio-video drift checks, no black segments or unexpected long silences. Main/short mean -17.5dB; peaks -1.1/-1.3dB. Final QA13:56:29Z. |
| Subtitles | PASS timing checks |33 main/7 short Spanish cues. Actual synthesized chunk durations, frame-aligned scene offsets; monotonic/in-range cues checked independently13:59:17Z. Burned ASS and matching standalone SRT. No word-level forced-alignment claim. |
| Visual inspection | PASS sampled layout | Actual decoded landscape normalization scene, portrait comparison/normalization frames and YouTube thumbnail inspected. Fixed missing SVG mark and clipped rightmost portrait value. Label0.0625, graph scale, disclosure and caption safe areas visible in final frame. Full human audiovisual watch pending. |
| Bilingual social kit | PASS technical | Nine platform/channel drafts have ES/EN copy, no upload/post/schedule. Six social image dimensions verified from generated profiles; YouTube chapter gaps >=10s. Placeholder canonical URL explicitly requires replacement after an authorized public release. |
| Artifact integrity | PASS | Every manifest-listed byte hash/length checked independently13:59:17Z;124 outputs. All human approvals absent and hybrid release issues still present. |
| Failure recovery | PASS | Final-input run13:53:26–13:53:33Z intentionally exited1 after complete TTS; receipt marks expected failure. Resume13:54:06Z reused all14 audio caches and completed13:56:30Z. No provider calls repeated. |
| Partial render | PASS | Variant `c4722ffea383b660fcb36f70cbc9f7525d9daea504cd51d2fd883e442f2c7691` changed only rule illustration. **14 audio hits**,13/14 pan hits,16/17 mux hits. Independent comparison13:58:03Z found only `rule` pan hash changed; every other clip/audio hash unchanged. Short byte hash unchanged. |
| Cache corruption | PASS |13:57:33Z copied pan cache into isolated probe directory, corrupted only copied clip and observed real renderer reject `Cached clip checksum mismatch`. Original immutable files unchanged and reverified. |
| Full replay | PASS |13:58:05Z verified all base hashes; no TTS/render steps executed. Base restored as viewer target. |
| Private viewer | PASS | Real HTTP integration13:59:17Z: loopback binding, noindex/no-store/CSP, MP4 range206, invalid range416, foreign Host and POST403, path escape denied. Live viewer3150 HTTP200 confirmed separately. No browser cookies or sessions accessed. |
| Typecheck/unit/build | PASS | Root, web and new demo TS checks;110 tests across18 files including budget/queue/Auth-readiness contracts; existing `npm run demo`; isolated offline Next production build. Rechecked types/tests after last SVG correction. |
| Database/cloud tests | NOT STARTED / not needed here | No SQL/schema/RLS/Auth changes or database access in this slice; no claim of rerunning database integration suites. |
| Human acceptance / release | OWNER REVIEW REQUIRED / BLOCKED | All approvals null; no independent scientific verification represented; no publishing adapter invoked. |

An earlier175wpm narration measured129.64s and correctly failed the120s ceiling. Final dictionary195wpm produced116.08s with all narration retained. Failed/old revisions remain private; they are not the selected review target.

## Cost and resources

External API/model calls: **0**. Gemini/API/video provider charges: **$0**. No billing activation, external provider availability claim, invented token usage or provider receipt. Local eSpeak receipt explicitly identifies local synthesis and zero external charge. Production ledger was neither bypassed for live calls nor mutated: none were dispatched.

Actual final resumed process measured with `/usr/bin/time -v` (includes child process CPU, unlike Node-only stage resource counters):

- Wall2:24.53; user CPU237.62s; system CPU26.17s;182% CPU.
- Maximum resident set777552KiB; no swap; exit0.
- Container ceilings2CPU/2GiB; no network. Filesystem/storage and electricity were not monetized. Do not infer render suitability for the current512MB cron worker from this demo.

Actual Docker image `sha256:d2a2ac4ff26ecf11f3679b56514c7865f2d0f466b954b7d096d7c2fef2b8acd5`; Node24.22.2, FFmpeg5.1.9 Debian12, eSpeak NG1.51, librsvg2.54.7. Executable/voice/font/lockfile hashes are in `toolchain.json`. Debian packages are not version-pinned indefinitely; preserve the local image for exact same-toolchain replay. Host-only verifier changes after image build do not alter the media renderer identity.

Raw evidence: `runs/2026-11-04T13-53-26-220Z-c1c1fbea.json` (expected failure), `runs/2026-11-04T13-54-06-068Z-dc47617e.json` (resume), `runs/2026-11-04T13-56-54-289Z-6337cc0f.json` (partial render), `runs/2026-11-04T13-58-04-341Z-7c4bc6a5.json` (replay), `final-process-resource.txt`, `verification/*.json` and isolated `probes/*/result.json`.

## Remaining acceptance and merge recommendation

Open the local review dashboard `http://127.0.0.1:3150`; watch both MP4s with sound, then inspect ES/EN articles and social drafts. Confirm pronunciation/intelligibility, subtitle timing, scales/numbers and caveats. No decisions have been submitted for the owner. Robotic formant synthesis is a technical rehearsal voice, not a production voice selection. No personal likeness, third-party footage or music used.

Keep the focused DEMO-001 PR Draft until owner feedback and remote CI have been reviewed. The code is suitable for technical review; it does **not** make real-paper SCI-004 accepted or authorize publishing. PR11 remains Draft at d160713 with its real scientific prerequisites unchanged. Production, OPS-003, cloud013 and general queues are untouched.

Next scope is integration planning in the runbook: persisted real source/review/revision loading, natural licensed TTS with separately approved pricing/ledger, bounded render workers with suitable memory, and exact-output human approvals. None is silently enabled by this demo.
