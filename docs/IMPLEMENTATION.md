# Реализация и локальное окружение

## Состояние Sprint 0

| Часть | Реализация | Граница |
|---|---|---|
| Портал | Next.js demo, responsive CSS, страницы статьи/политики | Только fixture |
| Редакция | Inbox, dossier/article/storyboard/review tabs | Решения в памяти вкладки, нет live Auth/БД |
| Домен | Zod dossier, типы остальных сущностей, release gate | Проверка контракта, не научный verifier |
| Источники | Чистая нормализация DOI/arXiv | Нет HTTP ingestion |
| AI | Gemini structured JSON adapter | Не вызывается demo/worker автоматически |
| Pipeline | Research prompt + offline rehearsal | Остальные AI-роли ещё не реализованы |
| Supabase | Migration + seed + RLS access test | Требует применения и интеграционного теста |
| Worker | Atomic claim, complete/fail, normalization handler | Для долгого render нужен heartbeat |
| Video | SRT и тихий FFmpeg preview | Нет TTS/asset montage/full editorial video |
| YouTube | Контракт publisher, env placeholders | Нет OAuth или upload |
| Бюджет | Локальная проверка арифметики | Нет атомарного ledger; live calls не подключать до него |

## Локально

`npm ci` → `npm run demo` → `npm run dev`. Fixture сохраняется в `artifacts/demo`. Портал намеренно не читает реальную БД до добавления Auth/authorization.

Для Supabase нужны Docker и CLI: `supabase start`, `supabase db reset`, `supabase test db`. Это локальная база. Затем заполнить `.env` значениями локального проекта, не production. Worker: `npm run worker:once`.

Пример задания после применения migration (SQL editor, привилегированный контекст):

```sql
insert into public.production_jobs(stage,idempotency_key,payload)
values('normalize_source','normalize:arxiv:2401.12345', '{"identifier":"https://arxiv.org/abs/2401.12345v2"}')
on conflict(idempotency_key) do nothing;
```

Запуск worker вернёт canonical ID в `production_jobs.result`. Это не загрузка статьи и не независимая проверка. Неподдерживаемые stage переходят в `held`, автоматически не повторяются.

## Права

Создать пользователя через Supabase Auth. Membership в `editor_members` назначать только административно. Сейчас authenticated может читать private tables лишь при membership; прямые browser INSERT/UPDATE запрещены. Позднее серверная команда проверяет сессию/роль и пишет через доверенный repository. Service-role key нельзя переносить в client component.

`articles` и `corrections` доступны анонимно только с `published_at <= now()`. Draft evidence и traces приватны. Публичный evidence DTO нужно добавить отдельно: только проверенные цитаты и атрибуция, без приватных промптов и содержимого документов.

## Vercel

Проект — monorepo. При отдельном репозитории в корне `science-portal`:

- Root Directory: `apps/web`.
- Framework: Next.js; установить Node 24.
- Install Command: `cd ../.. && npm ci`.
- Build Command: `npm run build` (в `apps/web`).
- Доступ к source files вне Root Directory должен быть включён для `packages/core`.
- Текущая demo-сборка не требует secret env.

После Auth добавлять server-only Supabase secrets лишь в соответствующие среды. Worker env хранится у worker-хостера; Gemini key на клиент не передаётся. Условие `PUBLICATION_ENABLED=false` в env — дополнительный будущий выключатель, а не реализованный publisher: в каркасе publisher вообще отсутствует.

## Worker / Docker

Из корня: `docker build -f apps/worker/Dockerfile -t science-worker .`. Запуск one-shot: `docker run --rm --env-file .env science-worker`. Его периодически вызывает планировщик выбранного хостера. До production не держать незавершённый render под 10-минутным lease без renewal.

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
