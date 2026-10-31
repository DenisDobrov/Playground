# Проверки Sprint 0

Дата: 21 октября 2026. Среда: Windows, Node.js 24.14.0, npm 11.9.0.

| Проверка | Результат |
|---|---|
| Установка зависимостей | Успешно; версии закреплены, package-lock.json сохранён |
| npm audit при install | 0 известных уязвимостей на момент установки |
| `npm run typecheck` | Успешно для packages/worker и web; web предварительно запускает next typegen |
| `npm test` | 21/21 passed |
| `npm run demo` | Успешно; bundle.json, report.json и captions.srt в artifacts/demo |
| `npm run build` | Успешно, Next.js 16.4.2; все страницы сгенерированы |
| `/api/health` | HTTP success, mode demo, publicationEnabled false |
| Browser: главная | Открывается, испанский контент, заметная маркировка fixture, визуальный осмотр |
| Browser: редакция | Переход с главной работает, dossier виден, Review tab показывает release blockers |
| Browser: review input | Ввод причины включает действия; запрос доработки отображается в текущей вкладке |
| Browser: publish | Кнопка disabled; нет publish API или live uploader |

Production build сначала упёрся в EPERM при создании Next.js `_not-found` внутри песочницы. Та же сборка вне песочницы завершилась успешно. Локальный preview также проверен после запуска вне сетевых ограничений песочницы. Внешние облачные ресурсы не создавались.

## Проверенные сценарии тестов

Блокировка synthetic release; полный reviewed contract; устаревший approval; несовпадение story IDs; несовместимая evidence scale; отсутствующая provenance; invented scene claim; текст без claims; неясные права на картинки; маркировка generated illustration; DOI/arXiv identity; запрет произвольного fetch target; budget arithmetic; SRT timing; отрицательная duration; неверный и усечённый structured output Gemini; отделение untrusted source payload от system instructions.

## Не выполнено в этом окружении

- Supabase migration/seed/SQL RLS tests и конкурентная очередь: Supabase CLI не найден, Docker Desktop engine не запущен. SQL подготовлен, но интеграционно не проверен.
- Docker build: engine недоступен.
- MP4 FFmpeg preview: FFmpeg в PATH не найден. SRT generator проверен; код запуска renderer не проверен на реальном FFmpeg.
- Gemini live call: ключи не предоставлены; adapter проверен mock HTTP responses. Платные вызовы не делались.
- Независимый verifier, TTS, YouTube OAuth/upload, remote Supabase/Vercel deploy: не реализованы/не подключены на Sprint 0.
- Отдельная мобильная browser QA не выполнялась; responsive CSS предусмотрен, но это не заменяет такую проверку.

Demo — архитектурный каркас и интерфейс на фикстуре. Его успешный запуск не является проверкой научной корректности, качественного ES narration или готовностью публичного MVP.

## Dobrov Academy — branding v0.1

21 октября 2026: добавлены логотип/знак SVG, favicon, PNG social card через Next ImageResponse, брендовая палитра, style board и Vercel web configuration. Typecheck, 21 тест и offline demo пройдены. Production build включает `/icon.svg` и `/opengraph-image`. Главная страница просмотрена в браузере: новый logo/название/цвета отображаются, доступное имя ссылки ведёт на Dobrov Academy. Brand board отрендерен в PNG и визуально проверен. Домены и Vercel-проект в этой задаче не создавались и не подключались; live deployment не проверялся.

## PR2 — существующий Supabase project + локальная база

21 октября 2026. Пользователь выбрал To-do-Db-project, project ref `upwrplsgunjanragbggb`; новые сущности перенесены в `academy`, bucket — `dobrov-academy-assets`. CLI 2.121.0 и PostgreSQL 17.11.0.004.

| Проверка | Результат |
|---|---|
| Docker / локальный Supabase | Запущен отдельный `dobrov-academy`, API 56321, DB 56322, Studio 56323 |
| Миграции | Все три применились к чистой локальной базе; seed выполнен |
| SQL / pgTAP | 4 файла, 28 проверок: RLS, membership, draft visibility, immutable revisions, права RPC, базовая очередь и отдельные legacy/academy tables — PASS |
| Конкурентные сессии PostgreSQL | Dedupe enqueue, единственный claim, reclaim после истечения lease, запрет stale finish, renewal, backoff и исчерпание attempts — PASS |
| Local worker smoke | enqueue `2401.12345` → `job.succeeded` через REST API academy — PASS |
| TypeScript | PASS |
| Unit tests | 3 файла, 31 проверка — PASS |
| Offline demo | PASS, 0 paid calls, publication blocked |
| Production web build | PASS |
| Cloud plan | Остановлен до подключения: SUPABASE_DB_URL ещё не заполнен |

Первоначальный диапазон 553xx оказался в списке зарезервированных портов Windows; перенесён на 563xx. Другие Docker projects сохранили свои контейнеры и порты. Local keys сохранены в игнорируемом `.env.local-worker`; облачные env-файлы не перезаписывались.

На момент указанного выше первого прогона credentials отсутствовали. Последующее завершение PR2: облачная инвентаризация и установка трёх миграций выполнены с подтверждением пользователя; private bucket создан, `academy` добавлена в Exposed schemas пользователем, Data API проверен. Cloud enqueue → normalize worker → succeeded проверен на задании `2a1e6b34-62b2-4ab1-bd89-7559290bc54f`. 59 legacy table names сохранены. Соединение PostgreSQL использует проверяемый Supabase CA, TLS verification не отключается. Namespace isolation не является отдельной Auth/service-role/ресурсной границей.

## Следующий срез — HLD v0.3 и независимые release contracts

22 октября 2026, ветка `codex/editorial-foundation`, поверх PR2.

- `npm test`: 4 файла, 45 проверок — PASS. Включая независимость article/video gates, stale dossier/script/render approvals, права voice/visual assets, отсутствующий evidence и сценовые input hashes/reorder.
- `npm run typecheck`: PASS.
- `npm run demo`: PASS, synthetic fixture, 0 paid calls, publication blocked.
- `npm run build`: PASS, Next production build.
- `git diff --check`: PASS.

Новых SQL миграций или изменений cloud/Vercel/Auth в этом срезе нет; DB tests не повторялись, поскольку SQL/storage/worker не менялись. Remotion/TTS/verifier eval и фактический incremental render не запускались. Scene planner рассчитывает идентичность задач, не подтверждает существование/целостность cached output. Новые gates проверяют контракт: до публикации нужен server service, который сам загружает доверенные persisted review/approval records. Demo пока сохраняет deprecated combined gate для обратной совместимости и остаётся заблокированным к выпуску.

## Auth и сохранённая редакция — 22 октября 2026

Ветка `codex/editorial-auth`, поверх PR3. Миграция 004 применена **только локально**, без reset. Cloud/legacy Auth/SMTP/redirect configuration не менялись.

| Проверка | Результат |
|---|---|
| TypeScript | PASS |
| Unit tests | 5 файлов, 50 тестов — PASS |
| SQL pgTAP | 5 файлов, 44 теста — PASS; editor/reviewer/outsider, RPC grants, dedupe, actor identity, idempotency, stale versions и запрет approve |
| Две PostgreSQL сессии | PASS; предыдущие queue/dedupe/lease/retry инварианты сохранились |
| Production build | PASS; editorial/login динамические, Proxy включён |
| HTTP integration | PASS; реальный magic link через локальную почту и PKCE, expired-session refresh/cookies, logout, forged cookie, no-store, persisted decision после reload, dedupe, CSRF, retry, stale tab, read-only reviewer, outsider и отозванная membership |
| Offline demo | PASS; 0 paid calls, publication blocked |

HTTP runner стартует собственный Next на свободном localhost:3000, использует только API 56321 / DB 56322 / Mailpit 56324. Синтетические Auth users и данные теста удалены; код не отправляет внешних писем и не читает cloud URL из env. Создана отдельная локальная membership пользователя для ручной проверки; адрес хранится только в игнорируемом `.env.local-web`, не в fixture/репозитории.

Ограничения: реальный cloud login и SMTP/redirect compatibility не проверялись; migration 004 не установлена в облаке. Automated source fetch, freshness metadata, ranking/gold-set workflow, paid models, ledger и publishing отсутствуют. Ручной intake не выдаётся за научную проверку.

### Исправление dev launcher

По результату запуска пользователя выявлен пропуск: HTTP integration проверял production `next start`, но не исходную команду dev с `node --env-file`. Next 16.4.2 переносил этот флаг из execArgv в дочерний NODE_OPTIONS, что Node 24.14.0 запрещает. Команды web:local и web:local:start переведены на launcher с `process.loadEnvFile()` без CLI-флага; env-файлы пользователя и системные переменные не изменялись.

Фактически проверены обе npm-команды: dev Ready, `/editorial` → 307 `/login`, `/login` → 200 с формой; production start Ready и форма входа → 200. 50 unit tests и diff check — PASS. Полный Auth flow ранее прошёл локально и в Database CI; после этого launcher-only исправления повторная отправка писем не выполнялась.

## Источники и English preview — 22 октября 2026

Ветка `codex/source-ingestion` от master после PR4. Cloud 004 применена после явного согласия, verified journal PASS. Существующей пользовательской учётке назначена academy editor membership после отдельного согласия; повторное чтение PASS. Auth/SMTP/templates/redirect URL/legacy objects не менялись, писем не отправлялось.

- Реальные metadata intake локально: arxiv-ai 21, arxiv-physics 9, nasa-news 1; 0 paid calls. Original/revision/release dates сохранены. NASA не считается primary study. DNS публичного NASA WordPress 192.0.66.108 корректно разрешён, private/reserved адреса по-прежнему блокируются.
- Export selection pool: 30 candidates, human labels pending, `artifacts/gold-set/candidates.json` ignored. Это не claim-verification gold set.
- Unit tests: 6 файлов, 59 — PASS; XML/DTD, categories, dates, stale feeds, private IP, retries и независимость EN review/approval.
- SQL pgTAP: 6 файлов, 58 — PASS; feed/role grants, lease/provider binding, aliases/manual DOI reuse, content freshness при 304, language version uniqueness и immutable language.
- Concurrent queue integration — PASS на непустой локальной базе; лишний claim второй сессии откатывается. Старые SQL fixtures изолированы в rollback transaction, чтобы реальные локальные candidates не ломали проверки.
- HTTP Auth + EN/ES routes — PASS; реальный local magic link/refresh/logout, no-store, CSRF, сохранение и роли, EN server HTML lang, ES сохранён, unknown EN article 404.
- Typecheck, production build, offline demo — PASS. Demo synthetic, 0 paid calls, publication blocked.

Новые migrations 005/006 **не применены в cloud**. Vercel live Auth environment и browser delivery smoke не выполнены; public portal ES/EN пока synthetic. Нет paid research, full-text ingestion, scheduler, ledger, verifier evaluation или законченного видео. Registry имеет строгий scope, DOI/arXiv linking основан на reported metadata и требует review при конфликте.

## Очередь и редакционная память — 22 октября 2026

PR5 дополнен замечаниями пользователя: новые только без решения; приватный каталог с поиском по title/identity/мотивам, фильтрами и pagination; повторное решение сохраняет историю. Migration 007 применена только в локальную Academy DB без reset.

Typecheck, production build, offline demo — PASS. 61 unit test и 67 SQL assertions — PASS. HTTP integration — PASS: исчезновение из новых, поиск по source/reason, сочетание фильтров, literal percent, страницы 20+1, пустая страница, повторное рассмотрение, сохранение фильтров, Auth/PKCE/refresh/logout, CSRF, stale-tab, роли и отзыв membership. Gold export v2 — PASS: 30 кандидатов, 4 с человеческими решениями, 1 resolved select/reject, без paid calls. Изменения cloud не выполнялись; 005–007 там pending. Тесты используют собственные синтетические данные и очищают их. Цикл и ограничения — EDITORIAL-FEEDBACK.md.

## PR6 — production budget, 22 октября 2026

Ветка codex/production-budget от master после merge PR5. Migration 008 локальная; существующие Academy candidates/решения сохранены, cloud/legacy/Auth не изменялись. В непустой local DB прошли 66 unit tests, 95 pgTAP assertions, отдельные concurrent budget и queue integration, HTTP Auth/catalog/budget integration, typecheck, production build и synthetic demo. Budget tests проверяют reserve/dispatch concurrency, dedupe, конфликт квитанции, expiry, crash recovery, uncertain billing и перерасход, блокирующий также ранее зарезервированные операции. RLS/grants и read-only reviewer dashboard проверены; outsider/anon не читают агрегаты.

Локальный план на текущий UTC месяц: $200, категории 30/50/50/70, story/month $10, video/month $25. Это конфигурация пределов, не расход. На настоящем локальном кандидате metadata review создал сохранённый unverified brief; повтор удержан под прежним operation ID. Четыре synthetic metering paths завершились с нулевым provider charge. Unpriced production plan сохранил null вместо выдуманных цен. Recover вернул released=0/uncertain=0 после smoke. Платных вызовов, озвучки и нового MP4 не было.

Тарифы/провайдеры, metered Gemini/TTS/Remotion adapters, paid research/verifier benchmark и publication не подключены. Monthly per-story/video caps не являются lifetime caps. Инварианты и следующие инструменты — PRODUCTION-BUDGET.md; актуальный план производства — SPRINTS.md.

## SCI-001 — External Research Review Import, 30 октября 2026

Ветка codex/sci-001-review-import от master после PR6. HLD и предыдущие компоненты сохранены. 009 применена только локально, cloud/legacy/Auth/SMTP не менялись. Реальный weekly review пользователя добавлен как unverified fixture; его network sources в CI не загружаются.

71 unit test — PASS; 115 SQL assertions — PASS. Actual-review integration — PASS: 10 секций, 4 linked/6 future-scope, original/hash, repeated import, old arXiv + journal event, отсутствие verified claims; всё откатилось. HTTP integration — PASS: Markdown paste и file upload, preview без записи, selected confirm, reimport, CRLF/LF document identity, оригинал в архиве, future/missing-primary, roles и CSRF; существующие inbox/catalog/budget/Auth сценарии сохранены. Queue и budget concurrent integrations — PASS. Typecheck, production build и offline demo — PASS; 0 paid calls, publication blocked.

При native textarea submission переносы могут нормализоваться браузером/HTTP до получения сервером; preview→confirm сохраняет полученный оригинал через JSON. Первый exact content_hash сохраняется, отдельный normalized document_hash не даёт создать второй обзор при LF/CRLF повторе. Нормализация DOI/arXiv не устанавливает peer review или verified evidence. Co-occurrence не создаёт alias; версии посторонней работы не присваиваются выбранной identity.

Известные границы: standard English Markdown parser, до 50 секций/256 KiB, нет automatic primary API enrichment или semantic paper merging; immutable pending items требуют будущей lineage-preserving link command. Облачная активация/migrations 005–009 отдельно; git merge не включает live Vercel env. Подробнее — SCI-001.md.

## SCI-001 final technical review / PR7 hardening

Два подтверждённых P2: work/type collision у недатированных событий и editor direct-RPC forgery immutable extraction. 009 сохранена без изменений; 010 добавляет private parser attestation и item-scoped undated event keys. Обычные Auth/editor/reviewer правила и release gates сохранены. Legacy inconsistent extraction на повторе удерживается, а не молча переиспользуется.

73 unit tests — PASS; 127 SQL assertions — PASS. Actual-review signed import/reimport — PASS с rollback; HTTP Auth/Server Actions — PASS, включая подставленный клиентом extraction (игнорируется), paste/upload и повтор. Queue и budget integration — PASS; Typecheck, production build и offline demo — PASS. Платных вызовов нет. Дополнительный local PostgREST smoke подтвердил подписанный вызов с настоящей editor-сессией. Native form test harness исправлен: unchecked checkbox не отправляется, как в браузере.

Приватный ключ сгенерирован/настроен только для локальной Academy DB и ignored .env.local-web без вывода значения и без изменения allowlist. Cloud migrations и live production settings не выполнялись. SCI-002 только спланирован; FUT-ARXIV-001 — отдельный post-MVP backlog. HLD/MVP scope не менялись. Подробности — SCI-001-FINAL-REVIEW.md.


## SCI-002 — 31 October 2026

82 unit tests (11 files), 163 SQL assertions (10 files), queue concurrency/recovery, production budget concurrency/billing, actual SCI-001 review rollback integration, SCI-002 rollback demonstration, production HTTP Auth/PKCE/Mailpit/CSRF/reviewer/outsider plus pending metadata confirmation/replay, typecheck, production build and offline demo passed locally. The build retains the existing metadataBase warning. Two ingestion assertions were updated for the intentional new human-confirmation gate; other regressions remain green. No paid LLM calls.

Opt-in network smoke: one approved arXiv ID lookup (1706.03762) and one Crossref DOI lookup (10.1038/s41586-021-03819-2) succeeded; exact hashes/timestamps are in ignored artifacts/metadata/network-smoke.json. It changes only local provider cooldown, not the editorial pool. Deterministic CI has no network dependency.

Migration 011 applied only to isolated local Academy; local data retained. Immutable snapshots and append-only resolutions/events, same-item multiple undated observations, exact retries/stale decisions and unresolved source conflict demonstrated in artifacts/metadata/demonstration.json (all fixture writes rolled back). HLD and installed 009/010 unchanged; no cloud/production configuration changes. SCI-002.md records limitations and minimum missing functionality for the first real dossier/brief/draft pilot; full content production remains unimplemented.


## SCI-003 — 31 October 2026

87 unit tests (13 files), 187 SQL assertions (11 files), queue/budget/SCI-001/SCI-002 regressions, research rollback integration, real production HTTP Auth/Storage/PDF worker/dossier/scoped scientific review/preliminary-versus-approved gate, typecheck, production build and offline demo passed locally. The production build retains the existing metadataBase warning. PDF tests use synthetic bytes; synthetic scientific reviews are explicitly test-only and cannot be cited as the real pilot acceptance.

A real existing local paper, arXiv:2610.30098v1, was enriched through the bounded primary adapter, explicitly operator-supplied as an eight-page CC BY PDF, parsed privately and visually checked on relevant pages. The persisted agent dossier has 5 claims, 4 quote-linked and 1 without evidence, with three passages and two intentionally false controls. Initial parse/persistence about 3.35 seconds, zero provider charge settled in the existing ledger. Repeated prepare returned the original settled operation as held; it did not create another dossier or human decision. Real human review/effort, whole-dossier approval and reviewed Brief remain pending until the user records them. The preliminary export retains these missing states instead of fabricating completion.

Only local migration 012 and local/private pilot data were installed; no existing data reset, no cloud migration, no production/Auth configuration change, no paid models and no publication. HLD and installed 001–011 files are unchanged. Contract, limits, acceptance instructions and next draft-only slice: SCI-003.md.

## VIDEO-001 — 31 October 2026

100 unit tests pass (including direct dossier release, per-scene invalidation, caveat linkage, likeness consent, exact-output review, source tampering and corrupt cache rejection). 187 SQL assertions pass. Local queue/concurrency/recovery, budget accounting, SCI-001 import/idempotency, SCI-002 metadata and SCI-003 research integrations pass; fixture writes rolled back/cleaned by their existing harnesses. Typecheck, offline demo and production build pass. Existing Next metadataBase warning remains; no production configuration was changed.

Real offline FFmpeg smoke: original non-person technical card, H264/yuv420p, 1920×1080, 30 fps, 3 seconds, one video stream and no audio; ffprobe verified. Repeated render reused cache and rechecked actual output bytes. Output SHA256 13be8205a57b81396a420afe4b60d292da0b2961953b4302eb68295d16a7ed2e. Frame inspected. ES technical SRT/report/MP4 remain ignored artifacts. Downloaded local Windows essentials build only after archive SHA256 matched distributor checksum 60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba; executables are ignored, not installed globally.

No paid calls, actual owner media, manufactured human scientific review, cloud migration or live configuration changes. This is a silent technical preview, not the 6–8 minute scientific pilot, TTS, Remotion execution, audiovisual acceptance or YouTube upload. The new PR is stacked on still-open PR9; merge dependency first, then retarget/recheck before merging this slice. See VIDEO-HLD.md for remaining work.
