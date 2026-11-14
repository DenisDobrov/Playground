# NEWS-003 — weekly preparation and four public languages

Status: implementation and source preparation, 14 November 2026. Deployment and release receipts are recorded separately; local checks do not imply publication.

## Existing workflow and owner decision

NEWS-001 is the active news workflow: one immutable package, source checks, one exact-package owner decision, published snapshots and scoped channel outbox. Historical SCI-003 source-meaning decisions require a real human and are not silently manufactured for news. The news dossier, agent source-meaning check and editorial brief now travel inside the same private immutable package, before its four article versions. Original research artifacts retain full provenance. Nothing writes a human scientific review, marks claims verified, or impersonates the owner.

The owner selected all 17 topics in the 7–14 November manifest. This selects preparation scope, not approval of text that did not yet exist. The new importer creates `owner_authorization = null` and never invokes `news_batch_approve` or `news_decide`. The existing **Подтвердить и опубликовать** button is the final decision for every available language revision and channel text in that exact package. No additional approval screen or account is introduced. A later revision invalidates that decision as before.

## Compatible contract

- Keep `news-release/1`, existing ES/EN fields, slugs, Story IDs, releases and history. Add optional `ru` and `zh-Hans` article fields, article SEO/tags, and private `research` version `news-003/1`.
- Four translations are one canonical Story with shared claims and evidence. Match primary DOI/arXiv/URL identities, existing aliases and event keys before importing. Background references are source links, not automatic identity merges.
- Store distinct first-public, preprint/version, journal, announcement and current-event dates, including unknowns and qualifications. Actual site publication remains the release RPC's `now()`. No backdating.
- Each claim retains a typed English assertion, locator, quantity/unit, object, conditions, comparator, sample, uncertainty and limitations. Author validation, external verification and our `not_performed` replication status remain distinct.
- `sourceReview` and `languageChecks` explicitly identify agent work. `humanReview` means the package awaits its normal owner decision, not an invented human review.
- New weekly packages use semantic heading blocks for **Por qué importa / Why it matters / Почему это важно / 为什么重要**, followed by 2–4 substantive sentences. This uses the existing escaped block renderer. Old archive packages remain valid without rewriting them.
- Preserve existing symbolic, original illustrations and label them in all four languages. They are not experimental images. Scientific photographs and demonstration clips require their own documented rights.
- Story 17's optional `videoBrief` links 3–5 dossier claim IDs, audience, angle, significance, autonomy limits, real demonstrations, rights and open questions. The existing Suggested for Video flag only collects this idea. No script, TTS, shot list, render or manuscript work starts.

## Public routes and language selection

Existing Spanish and English URLs remain. Russian uses `/ru`, Simplified Chinese `/zh`; the corresponding release and HTML language code is `zh-Hans`. New routes reuse the same public release service and components. Lists, article framing, sources, methods, dates, search, topics, archive and navigation are localized; the old archive is not bulk translated.

Only `/` negotiates language: manual `da-language` preference first, then supported `Accept-Language` tags by quality, then Spanish. It always redirects to an explicit home, including `/es`; existing `/` bookmarks remain usable. Explicit language/article URLs bypass negotiation. Manual switches preserve the canonical story and are remembered for one year. No IP geolocation, client-side initial redirect or locale loop. The neutral redirect is private/no-store with `Vary: Accept-Language, Cookie`; published explicit routes do not inherit another reader's choice. Rendering Spanish directly at `/` was rejected because Next's rendering response replaces the negotiation Vary header.

An unpublished translation displays a clear notice and the available article with its actual `lang`. It is noindex and canonicalizes to the real version. Article hreflang and sitemap alternatives include only actual releases. Public sources and SEO never expose the private dossier or drafts.

## Database and rollout

Only additive scoped migration `202611140016_news_languages.sql` is eligible. It extends the release-language constraint, validates new preparation checks server-side, emits every present language atomically under the existing decision, and checks actual required release languages before a delivery can be claimed. Existing ACLs, RLS, roles, Auth, legacy schemas, budget ledger and old releases stay unchanged. Do not apply unrelated pending migration 013 or run a reset/db-push.

Before cloud application: verified Academy-only backup and isolated restore; compare installed migration checksums; run the local migration and release-gate acceptance. Apply only 016 in one transaction with the installation lock and verify preserved data/ACLs. Deployment rollback can restore the previous web build; retain additive schema and all immutable history. Draft import does not publish or send channel messages.

## Acceptance and evidence

Required: core/web typecheck, unit tests, local demo, production build, local DB and news integration; targeted four-language release, missing-translation/SEO and negotiation checks; public/private UI inspection. Record unavailable checks honestly. Verify that old public article/video bindings survive. Prepare 17 cards/68 versions and a 17-row status manifest with canonical IDs, dates, real check status, language URLs and blockers. Only a recorded owner decision and resulting release snapshots justify “published”.

External model API calls for this preparation: 0. No synthetic provider usage or independent replication receipts.
