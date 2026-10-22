# Реализация и локальное окружение

## Обновление 22 октября 2026

Последний срез: локальный metadata intake arXiv AI/physics и NASA discovery; provider leases/cooldown, conditional requests, alias dedupe, отдельные даты/flags. Есть EN public demo и LocalizedArticle contract с отдельным review. Migrations 005–007 локальные. Cloud 004 и editor membership уже проверены после явных подтверждений; Vercel Auth activation ещё предстоит. `INGESTION.md` содержит команды, человеческие проверки и актуальные границы; более ранние описания ниже — история срезов.

Следующий реализованный срез: opt-in live editorial Auth + manual DOI/arXiv inbox и persisted decisions. Роли editor/reviewer проверяются server-side и в SQL RPC. Миграция 004 проверена локально; облако в этом срезе не изменено. По умолчанию Vercel previews остаются demo. Запуск и ограничения — `EDITORIAL.md`. Таблица Sprint 0 ниже отражает исходный каркас; описание отсутствия Auth относится к нему, а не к новому live mode.

Актуальный план — `SPRINTS.md`, архитектура — HLD v0.3. Добавлены отдельные `articlePublicationIssues` / `videoPublicationIssues`: approval статьи связан с article/dossier revisions; видео дополнительно требует published article reference, script revision, права используемых visual/audio assets и checksum-approved MP4. Это чистые контракты, а не доверенный publisher: reviews/approval должны загружаться server-side после Auth. Старый combined `publicationIssues` deprecated и сохраняется для совместимости синтетического demo; live adapter не должен его использовать.

`planSceneRenders` формирует детерминированные idempotency keys по входам сцен и отдельный assembly key. Реальные Remotion jobs, cache storage/checksum verification и SQL persistence пока отсутствуют. Cloud foundation (три миграции, academy Data API, private bucket и normalize worker smoke) уже проверен; новый Supabase project не требуется. Ниже описаны фактические границы остального каркаса.

## Состояние Sprint 0

| Часть | Реализация | Граница |
|---|---|---|
| Портал | Next.js demo, responsive CSS, страницы статьи/политики | Только fixture |
| Редакция | Inbox, dossier/article/storyboard/review tabs | Решения в памяти вкладки, нет live Auth/БД |
| Домен | Zod dossier, типы остальных сущностей, release gate | Проверка контракта, не научный verifier |
| Источники | Чистая нормализация DOI/arXiv | Нет HTTP ingestion |
| AI | Gemini structured JSON adapter | Не вызывается demo/worker автоматически |
| Pipeline | Research prompt + offline rehearsal | Остальные AI-роли ещё не реализованы |
| Supabase | Схема academy, migration + seed, локальные/облачные команды | Облачный доступ требует credentials пользователя |
| Worker | Atomic enqueue/claim, complete/fail, lease renewal, normalization handler | Реальные AI/video стадии ещё не подключены |
| Video | SRT и тихий FFmpeg preview | Нет TTS/asset montage/full editorial video |
| YouTube | Контракт publisher, env placeholders | Нет OAuth или upload |
| Бюджет | Локальная проверка арифметики | Нет атомарного ledger; live calls не подключать до него |

## Локально

`npm ci` → `npm run demo` → `npm run dev`. Fixture сохраняется в `artifacts/demo`. Портал намеренно не читает реальную БД до добавления Auth/authorization.

Для Supabase нужен Docker; CLI установлен как зависимость проекта: `npm run db:start`, `npm run db:test`, `npm run db:test:integration`. Project ID `dobrov-academy`, порты 563xx. Затем `npm run db:local:env` создаёт отдельный `.env.local-worker`; локальный worker: `npm run worker:local`. Облачный `.env` этим не перезаписывается. Существующий To-do-Db-project подключается по инструкции `SUPABASE.md` без reset или замены его migration history.

Пример задания после применения migration (SQL editor, привилегированный контекст):

```sql
insert into academy.production_jobs(stage,idempotency_key,payload)
values('normalize_source','normalize:arxiv:2401.12345', '{"identifier":"https://arxiv.org/abs/2401.12345v2"}')
on conflict(idempotency_key) do nothing;
```

Запуск worker вернёт canonical ID в `production_jobs.result`. Это не загрузка статьи и не независимая проверка. Неподдерживаемые stage переходят в `held`, автоматически не повторяются.

## Права

Создать пользователя через Supabase Auth. Membership в `academy.editor_members` назначать только административно. В облаке Auth общий со старым приложением; его настройки не менять без учёта прежнего использования. Сейчас authenticated может читать private tables лишь при membership; прямые browser INSERT/UPDATE запрещены. Позднее серверная команда проверяет сессию/роль и пишет через доверенный repository. Service-role key нельзя переносить в client component.

`academy.articles` и `academy.corrections` доступны анонимно только с `published_at <= now()`. Draft evidence и traces приватны. Публичный evidence DTO нужно добавить отдельно: только проверенные цитаты и атрибуция, без приватных промптов и содержимого документов.

## Vercel

Проект — monorepo. При отдельном репозитории в корне `science-portal`:

- Root Directory: `apps/web`.
- Framework: Next.js; установить Node 24.
- Install Command: `cd ../.. && npm ci`.
- Build Command: `npm run build` (в `apps/web`).
- Доступ к source files вне Root Directory должен быть включён для `packages/core`.
- Текущая demo-сборка не требует secret env.

Для первого импорта выбирать **Import single project** у `web`, Project Name `dobrov-academy`. Install/build также закреплены в `apps/web/vercel.json`. Пошаговая инструкция и домены — `VERCEL.md`; первый брендинг — `BRAND.md`.

После Auth добавлять server-only Supabase secrets лишь в соответствующие среды. Worker env хранится у worker-хостера; Gemini key на клиент не передаётся. Условие `PUBLICATION_ENABLED=false` в env — дополнительный будущий выключатель, а не реализованный publisher: в каркасе publisher вообще отсутствует.

## Worker / Docker

Из корня: `docker build -f apps/worker/Dockerfile -t science-worker .`. Запуск one-shot: `docker run --rm --env-file .env science-worker`. Его периодически вызывает планировщик выбранного хостера. Worker продлевает действующий lease каждые 30 секунд и обрабатывает SIGINT/SIGTERM; будущие долгие стадии также обязаны учитывать AbortSignal и прекращать работу при потере lease.

Docker image содержит FFmpeg; для preview использовать writable volume:

```powershell
docker run --rm --mount "type=bind,source=$($PWD.Path)\artifacts,target=/app/artifacts" science-worker npm run video:render
```

Сначала создать `artifacts` локально. Для локальной базы из контейнера адрес `localhost` указывает на контейнер: задать доступный Supabase URL с `host.docker.internal` там, где это поддерживается. Worker image — основа для разработки, не оптимизированный production image.

## Границы провайдеров

Gemini API key и model ID задаются явно. Adapter возвращает валидированный JSON и usage metadata; оркестратор обязан дополнить их cost/rules/audit persistence и reservation до реального вызова. Поставщик verifier должен быть независим от Google. TTS выбирается по естественности ES, произношению терминов и расходу на минуту; сейчас есть только `VoiceProvider` interface.

OAuth YouTube и Supabase Google login — разные решения: пользователь выбрал Google только для Gemini и YouTube, поэтому Google login не заложен как обязательный способ входа. Для редактора можно начать с Supabase email magic link.

## Исправления

Не обновлять текст опубликованной revision на месте. Новая Article/Script version → новая review/approval → Publication указывает точные revisions. Correction ссылается на старую и новую статью. Для YouTube нужна политика pinned comment/description либо перевыпуск при существенной ошибке; её должен реализовать адаптер.
