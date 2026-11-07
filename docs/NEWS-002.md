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
