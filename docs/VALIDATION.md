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
