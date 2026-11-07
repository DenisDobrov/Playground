# DISTRIBUTION-002 — delivery, static campaigns and audience readiness

7 November 2026. NEWS-001 remains the product mode. No video, manuscripts, advertising, new subscriptions or paid model calls.

**Continuation after PR20 merge:** the three drafts are now imported into production and awaiting the owner's existing two-button review. Search Console processed the submitted sitemap; free Hobby Web Analytics is enabled in the project, with collection/SEO code in the next reviewed web change. Exact timestamps, package IDs and validation: [SEO-001](SEO-001.md). The audit/dry-run statements below describe the earlier baseline.

## Production evidence

Web revision `9a0ef92c13e07d2c27e62338469cab2c8854582d`, deployment `dpl_3CYMptXnLuAK34fE1uRFqJgUWmmz` remains unchanged during delivery/audit. Existing account roles and links are unchanged.

The outbox was inspected before sending. One Facebook digest and one WhatsApp Channel update were posted, then reconciled against all 17 exact approved packages. No per-story duplicate posts. Seven channels delivered; Telegram and X are deferred by owner (`OWNER_DEFERRED`), not scheduled for retries.

| Channel | Verified publication |
|---|---|
| Facebook | [Digest](https://www.facebook.com/permalink.php?story_fbid=pfbid043FwcLeWhp6semLaN1FMjJvmSmeGdiMW57kBikByidaHQENGrbh9eZGqvwTaoJi3l&id=61596320661841), ID `122097860409544022`, sent 09:33 UTC, reconciled 09:40:34 UTC |
| WhatsApp Channel | [Digest](https://whatsapp.com/channel/0029VbDqlX2JP21B9kIR2m0U/100), sent 09:49 UTC, reconciled 09:51:25 UTC |
| Instagram | [Four static cards](https://www.instagram.com/p/DfbxMpOEUEW/) |
| LinkedIn | [Digest](https://www.linkedin.com/feed/update/urn:li:share:7524750109243236352) |
| Threads | [Digest](https://www.threads.com/@dobrovacademy/post/DfbvdjfAJLi) |
| Bluesky | [Digest](https://bsky.app/profile/dobrovacademy.bsky.social/post/3mzpj7mrrk227) |
| YouTube Posts | [Text post](https://www.youtube.com/post/UgkxJv4WZplpYVZJsgD8N26-HGmNneI-sGEE); external links remain plain text pending platform verification |

WhatsApp was created in the existing Business account after separate owner approval of terms and the final name/logo/description. No private-chat broadcast, phone/profile rename, account creation, advertising or subscription. The sent update is text with the existing site's preview, not generated media.

### Meta rights are two distinct results

- **Page publishing PASS:** existing Instagram-authenticated Business Suite composer successfully published to the existing Facebook Page; Instagram was deselected to prevent duplication. Public visibility, boost off.
- **Portfolio administration BLOCKED:** settings redirect explicitly reports `PENDING`. Publishing success does not establish full control.
- Existing closed support case inspected. Meta's AI assistant reports `Autoclose`; its explanation of possible self-service instructions is a hypothesis, not a human case resolution or an exact closure trigger. No working reopen action was exposed. One continuation draft is retained privately for owner approval. No duplicate case, document upload, role change or unlinking.

## Static campaign contract

Three draft campaigns reuse published items 7 (AI experience replay), 2 (horizon analogue), and 16 (male-mouse survival). Six original 1080×1350 PNG typographic cards, ES/EN captions, canonical/UTM links and source caveats are prepared privately in `artifacts/distribution-002`. No claim of scientific verification beyond the published source-checked summary.

An optional `campaign` field binds the base package ID/hash and both images' exact bytes, language, rights, dimensions and SHA256 to the existing immutable package. PNG-only bounded data URLs avoid public draft uploads or external tracking image URLs. The authenticated newsroom displays the selected language image. Existing two decision buttons, optional comment and idea flags remain; no additional required forms.

`scripts/news-campaign-import.ts` is an operator command, defaults to a transaction that rolls back, and never approves or sends. It locks current state, verifies the released base/hash, preserves article/source content exactly, checks PNG dimensions and hashes, and imports only three scoped drafts. Identical replay is idempotent; a competing version is rejected. The original batch approval command refuses campaign packages. RLS and existing `news_decide` remain unchanged.

Channel texts may contain only selected supported channels. These drafts omit deferred Telegram/X. Every newly selected delivery still starts blocked until access/actual sending is reconciled. An owner click uses the existing release behaviour: a new immutable ES/EN snapshot of the unchanged article plus selected social outbox entries; no unattended social publisher is implied.

No schema migration is required. Draft assets are omitted from anonymous release DTOs. The preparation dry-run against the three actual published base packages passed and was fully rolled back; temporary IDs in that report are not persisted draft IDs. Do not import production drafts until the updated review UI is deployed.

Operator usage (credentials in ignored local files only):

```text
node --import tsx --env-file=.env.local scripts/news-campaign-import.ts --production=distribution-002 --prepared=<private prepared-campaigns.json> --report=<private report.json>
```

Without `--apply`, every proposed change rolls back. Add `--apply` only for the intended draft import after UI rollout. Then the owner uses `/editorial/news`; do not use a batch approval. Any later substantive change requires another immutable version and decision. Before each actual send recheck the live channel, outbox, current decision and exact package/asset hashes.

## SEO and analytics audit

38 public pages returned 200; language, one H1, canonical and paired hreflang are present. Sitemap includes all 34 language articles and two digests (36 URLs); homepage entries are absent. Robots exposes the sitemap and excludes private application paths. No public release was changed by the audit.

Gaps observed on 7 November:

1. Search Console property access works. Submitted sitemap list is empty. The ES digest URL is unknown to Google/not indexed; no referring sitemap or crawl is reported. This is a fresh-release discovery gap, not evidence of a penalty. Performance overview shows zero search clicks, indexing processing and no field experience data.
2. All 38 HTML responses lack `og:image` and JSON-LD. Basic OG text/type is present; image previews need an explicit absolute image URL. Local build also warns about missing `metadataBase`.
3. Vercel API explicitly returns `web_analytics_not_enabled`; no analytics script found in public HTML. Visits are unmeasured, not zero.
4. Homepage and weekly digest repeat substantial content; shorten the home to editorial navigation/teasers while keeping stable weekly archives. Use a clear visible editorial byline/method/correction route and truthful Article metadata, not invented individual scientific authorship.

Priorities: submit the existing sitemap and inspect representative ES/EN URLs; add explicit share images and truthful Article JSON-LD; enable basic privacy-scoped analytics only after owner approval. No paid plan/add-on is needed for the proposed initial measurement. Vercel's current Hobby allowance is 50,000 events/month, but custom events and UTM reporting are unavailable on Hobby. UTM links in draft copy do not themselves create analytics or prove campaign attribution. Use article/referrer pageviews and native channel statistics initially; do not promise tracked follow-button conversions.

Primary references: [Google Article markup](https://developers.google.com/search/docs/appearance/structured-data/article), [Vercel current analytics pricing](https://vercel.com/docs/analytics/limits-and-pricing). Structured data helps interpretation and does not guarantee indexing or ranking. Browser/mobile performance metrics were not measured by the single-location HTTP audit.

## Minimal reader acquisition plan

After owner approval through the existing card:

| Relative day | Campaign and placement | Measure |
|---|---|---|
| 0 | Existing weekly release; add a visible route from site/profile to the new WhatsApp Channel in a separately reviewed UI change | Channel followers and published article visits once analytics exists |
| 1 | AI replay: ES Instagram/Threads/WhatsApp; EN LinkedIn/Bluesky; Facebook bilingual | Native reach, saves, outbound clicks where the platform exposes them |
| 3 | Horizon analogue: same channels, strongest image and explicit analogue caveat | Visits to the two horizon pages and channel engagement |
| 5 | Mouse result: statistics plus sample size and no human inference | Reads/saves; monitor misunderstandings and respond with source caveats |
| 7 | Compare per-article/referrer totals and native post metrics; retain the clearest framing for the next release | Report unavailable metrics as unavailable; choose one improvement |

These are proposed publication slots, not created automations or pre-approved sends. No unsolicited private outreach. No guaranteed follower target without a measured baseline. Budget for new paid tools/models/ads in this slice: zero.

## Verification

126 unit tests PASS; typecheck PASS; production build PASS (existing metadataBase warning recorded); synthetic demo PASS with publication blocked; local NEWS integration PASS including campaign idempotency, immutable images, exact-version approval, stale and reviewer denial, no public draft assets and no inherited approval/outbox. Integration fixture changes rolled back. Three actual campaign preflight imports rolled back successfully. Cloud migrations/Auth/worker configuration unchanged.

Private report and screenshots: `artifacts/distribution-002/DISTRIBUTION-002-REPORT.html`; campaign preview: `CAMPAIGNS.html`; immutable original NEWS acceptance artifact retained separately.
