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
