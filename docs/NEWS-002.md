# NEWS-002 — standalone quantum infrastructure analysis

Issue [#22](https://github.com/DenisDobrov/Playground/issues/22), 7 November 2026. Article release precedes the private ideas/public design follow-up. Marketing campaigns, video, manuscripts and paid model calls stay paused.

## Publication contract

The owner supplied the bilingual package and explicitly requested publication. Preserve its exact source bytes and instruction hash through the existing trusted importer and `news_batch_approve`; origin is `owner_batch_instruction`, never an invented UI decision or scientific review. Source meaning checks do not constitute independent scientific verification.

The additive JSON contract supports escaped headings, paragraphs and sourced tables, optional analysis/topic fields, month-precision research dates and related identifiers for one reference. The paragraph index must match the body, table cells must match their headers, and table URLs must occur among the package sources. Legacy packages remain valid. No migration, role change or paid service is needed.

`news-import --standalone=news-002 --production=news-002 --dry-run` checks editor membership, exact source/prepared/instruction binding, slug and DOI/arXiv conflicts before any mutation. Actual release additionally requires `--release-owner-instruction`. It never silently overwrites a conflicting event or overrides a later explicit reject. The old weekly approval switch is rejected in standalone mode. Repeated import retains IDs/history and does not duplicate release snapshots/outbox.

Period `standalone:2026-11-07` keeps this analysis outside the immutable 1–7 November weekly archive. Both public routes retain a shared stable slug. The journal issue is June 2026, with month precision; actual site publication is recorded by the release RPC. AI video rationale belongs to the immutable package, separate from the optional owner comment. Video=true and science=false collect ideas only.

## Source check

Direct publisher HTML Table 1 inspected on 7 November 2026 after the owner completed the publisher challenge:

- Practical / Small Full / Large Full FTQC: **12 / 27 / 4 MW**.
- Direct water consumption: **45 / 104 / 30 million litres/year**.
- Helium-3 inventory: **3,333 / 8,640 / 3,000 litres of gas at 0 °C and 1 atm**.
- Table includes control electronics, cooling and associated equipment; the principal classical CPU/GPU workload is outside the study boundary. These are conditional superconducting FTQC scenarios, not measured future machines.

[Publisher](https://www.sciencedirect.com/science/article/pii/S2667095X26000048), [ORNL metadata](https://impact.ornl.gov/en/publications/uncertain-quantum-computing-futures-and-potential-energy-and-phys/). No claim that a PDF was inspected. arXiv 2209.05469 and PRX Quantum 4.040319 remain two versions of one supporting study. The IBM memory comparison retains its 0.1% physical-error assumption; it is not an electricity measurement.

The supplied handoff files passed their SHA256 manifest. Private source bundle hash: `ad781facd2865730612429785165eab59c40fc088b1c6ca46131f42b247c6a40`. Production read-only preflight at 14:45:24 UTC found no existing primary DOI/package, one existing editor and only two completed normalize jobs; no pending production work. Migration journal ends at 015, with 013 absent and untouched.

## Acceptance and rollback

Validate standalone schema/body/source alignment, anonymous EN/ES rendering, semantic table, separate source/publication dates, escaped markup, unchanged weekly archive, immutable/repeated import, existing Auth/RLS and queue/budget checks. Publication and channel permalinks are recorded only after observed success, separately from code CI.

For web regressions, restore the previous deployment `dpl_6NHc8QyrcYpz7q7i3WGRF7byJTUf` / `41697c5159bd758c208636599aab0e0a319c1e3f`. Keep release/history records and external posts; do not erase them as part of code rollback. Stop further delivery and reconcile any ambiguous send before retrying.

## Observed site release

PR [#23](https://github.com/DenisDobrov/Playground/pull/23), CI and Preview green, merged as `7aa290b2708df38ee018f61656d6b6e16955ba7e`. Production `dpl_6HJM2cmUb1hTrK34126QeYiyG3Zj` READY on dobrov.org before publishing.

Release timestamp **2026-11-07 14:53:54.235316 UTC**:

- [English](https://dobrov.org/en/news/quantum-computers-beyond-qubits-energy-water-helium-3)
- [Español](https://dobrov.org/noticias/quantum-computers-beyond-qubits-energy-water-helium-3)

Readback at 14:55:04 UTC confirmed two exact-language snapshots, one genuine owner-instruction decision, empty owner comment, video=true/science=false, nine blocked delivery records pending actual browser delivery, and no new production jobs. Package `14e54c9d-e4ea-4a28-9d08-dd3357e91b70`, hash `8cee2dcdd0d76d351453225e934b78e399a75f13ca6cbd0f2d45a15362735b10`. Anonymous HTTP 200, semantic table, reciprocal language routes, Article metadata and unchanged weekly archive passed. Source month remains June 2026. No paid calls.

## Separate design and private ideas follow-up

- Existing `?view=video` becomes a prominent private Video Ideas tab with an actual count. Compact metadata is paged for search; full immutable packages load only for the selected page. Current and previous public versions are distinguished using release records, independently of channel delivery. AI rationale/version is read-only; owner comment is never prefilled. Existing two-button decision RPC and permissions stay intact.
- News/Analysis/Topics/Search/Archive routes in ES/EN read only public release DTOs. Accent-insensitive search, chronological order, actual first-publication dates, populated topic pages, 12-card pagination and reciprocal language navigation. No invented popularity, ratings, newsletter or public video section.
- Original navy/blue/paper layout with original symbolic vector editorial illustrations. They are explicitly labeled, contain no measured data and reuse no publisher artwork. The public source table remains attributed to the original study. Share images remain the existing headline template, corrected to use actual first-publication dates instead of a hardcoded weekly period.
- Article/BreadcrumbList schema, populated sitemap entries and noindex for internal searches/filter duplicates. Existing analytics privacy controls and exclusion of private pages are unchanged; no new tracking or subscription.
- Local checks: 137 unit tests, typecheck, production build and expanded built-web SEO tests pass. Source-table width remains scrollable on 360/390, with no page overflow; reading column is 740px on desktop. Original before screenshots were captured at 360/390/768/1440/1920. After-production screenshots and channel observations follow deployment; local preview is not production proof.

This follow-up can roll back to PR23's deployment without removing the published analysis or its history. No database migration is required.

## Production acceptance — 7 November 2026

PR [#24](https://github.com/DenisDobrov/Playground/pull/24) deployed as `84c6dd7162c2d88b448005940c92d823aa32e8db`, deployment `dpl_35xzJvnVHEpx6g1w4vN3Zggq96n8`, READY. Article publication preceded this redesign. The final acceptance follow-up fixes one observed table-header contrast defect and adds the three remaining verified official channel links to the footer. It changes neither article snapshots nor publication dates. The final rollout SHA and repeat audit are appended to Issue #22 after deployment.

### Actual channel delivery

Destination feeds and the exact package outbox were checked before each send. All nine actual browser sends were reconciled into the existing delivery history; no paid platform API was used.

| Channel | Actual publication | Observed presentation / limitations |
|---|---|---|
| Telegram | [message 4](https://t.me/dobrovacademy/4) | ES text, both URLs, clickable ES article card. |
| X | [2119089627273273350](https://x.com/DobrovAcademy/status/2119089627273273350) | EN text, clickable EN article card. No Premium activation. |
| LinkedIn | [share 7524855935736168448](https://www.linkedin.com/feed/update/urn:li:share:7524855935736168448/) | Company Page, EN text with both URLs. LinkedIn selected the ES card from the second URL. No personal repost or boost. |
| Facebook | [post 122098141209544022](https://www.facebook.com/permalink.php?story_fbid=pfbid02DbAsj3mFxe7kgm1knA1X5ozi5qU4qTTAMWszMBBYbf2kcd4b4f2CcwTDgWJnpKGAl&id=61596320661841) | Page post via existing Business Suite, ES card. Composer reported an error after creating the post; the published feed and permalink resolved the ambiguity, with no resend. Posting capability does not establish full portfolio control. |
| Instagram | [Dfchx3wjPFA](https://www.instagram.com/p/Dfchx3wjPFA/) | Static original 1200×630 title card, preserved original crop, ES caption and custom ES alt text. Caption URLs are not clickable; profile bio contains dobrov.org, but no clickable website link was exposed in this desktop profile view. Automatic Threads cross-post stayed off. |
| Threads | [DfchYhLAJz5](https://www.threads.com/@dobrovacademy/post/DfchYhLAJz5) | ES text and clickable ES card. |
| Bluesky | [3mzq7ss2crc2i](https://bsky.app/profile/dobrovacademy.bsky.social/post/3mzq7ss2crc2i) | EN text and clickable EN card; post language explicitly English. |
| WhatsApp Channel | [update 101](https://whatsapp.com/channel/0029VbDqlX2JP21B9kIR2m0U/101) | Existing public channel only; ES text, both URLs and article preview. No private chat broadcast. |
| YouTube Posts | [UgkxbnGicLQWppz4a3dJ-l3Vm9bNyBKwjxIK](https://www.youtube.com/post/UgkxbnGicLQWppz4a3dJ-l3Vm9bNyBKwjxIK) | Public text post only. YouTube explicitly requires one-time account verification for clickable external links; URLs remain text. Verification was not started. |

Existing profiles observed as Dobrov Academy / dobrovacademy, with Spanish evidence-first bios and ES/EN positioning. X, LinkedIn, Threads, Bluesky and YouTube exposed the intended website/profile destinations; Instagram's desktop-link limitation is separate from delivery. Actual cards were inspected in the composer or published feed, not inferred solely from OG tags. No rights, account links, portfolio recovery cases or subscriptions were changed.

### Private workflow and responsive evidence

Authenticated production [Video Ideas](https://dobrov.org/editorial/news?view=video) showed four ideas, including this published analysis. Search `cuantica` found one result despite the accent in the title. Expanded detail showed **9/9 delivered**, empty optional owner comment, video checked, science unchecked, and exactly the existing approve/reject controls. AI rationale remains version-bound `news-002/1`, separate from the owner field. These checks submitted no decisions. Production queue still contained only the two previously succeeded `normalize_source` jobs; no new media/research job.

Before/after homepage and article screenshots exist at **360, 390, 768, 1440, 1920** widths in the private `artifacts/news-002/screenshots` directory. Measured document widths equalled scroll widths at all five sizes. Mobile table retains all columns in its own scroll region; ArrowRight moved it by 40px with keyboard focus and a visible blue outline. Desktop reading column is 740px. Header navigation has 44px-high targets; brand/link focus is visible. No publisher images were copied.

### SEO and performance evidence

Anonymous production audit at **15:52:49 UTC**: **76 checks PASS**, **64 unique sitemap URLs**, all sitemap routes HTTP 200; exact self-canonicals, reciprocal languages, one H1, Article/BreadcrumbList, organization byline, accurate unchanged release dates, separate June month, 1200×630 PNG metadata, real topic/search/archive routes, noindex search/filter duplicates, unpublished 404 and anonymous private-route redirects. Weekly archive remains unchanged; private rationale is absent from public pages. Existing privacy-scoped analytics was preserved.

Search Console inspected each new ES/EN URL: **URL unknown to Google / not indexed**, no crawl yet. Existing sitemap: processed successfully, last read 7 November, 36 discovered URLs at observation time (the currently served sitemap contains 64). No duplicate sitemap submission, indexing guarantee or traffic claim.

[Initial PageSpeed report](https://pagespeed.web.dev/analysis/https-dobrov-org-noticias-quantum-computers-beyond-qubits-energy-water-helium-3/wzzjuel16z?form_factor=mobile), 15:48 UTC, Lighthouse 13.6.0:

| Lab metric | Mobile | Desktop |
|---|---:|---:|
| Performance / SEO / best practices | 100 / 100 / 100 | 100 / 100 / 100 |
| Accessibility | 96 | 96 |
| FCP / LCP | 0.8s / 0.8s | 0.2s / 0.2s |
| Total blocking time | 50ms | 0ms |
| CLS | 0 | 0 |

No field data is available, so this is not a field INP/Core Web Vitals pass. Initial accessibility finding was white table-header text on a light background caused by competing component/publication styles. The follow-up makes the component's background/text pair explicit and consistent. Production remeasurement follows rollout; do not describe the initial 96 as 100. The earlier unauthenticated PSI API attempt returned quota 429; the official web report succeeded without a key or billing change.

Local validation of the correction: production build and built-server SEO integration (24 anonymous fixture reads) passed. PR23/24 CI also passed Foundation (typecheck, 137 unit tests at PR24, demo, build, SEO) and Database integration (SQL/RLS, queue, budget, imports, metadata, research, content, news and editorial web checks). CI uses isolated local data; no cloud migrations were applied.

No paid AI, video, ads or subscriptions were activated. Direct incremental AI/API spending for this task: **$0**; existing hosting-plan usage is not claimed to be free or measured by this report. Immutable package/source hashes, channel receipts, screenshots, responsive dimensions and audit output remain in ignored private artifacts. Final contrast/rollout evidence is appended to Issue #22. Rollback restores PR24 (or PR23 for the entire design change) and retains public release/history/outbox records.
