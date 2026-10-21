# Science portal · стартовый каркас

Единое ядро AI-редакции → испанская статья + видео с доказательствами. Рабочее имя интерфейса **Umbral**, бренд пока не утверждён.

## Быстрый запуск в VS Code

Нужен Node.js 22.14+; проверено с Node 24. Из этой папки:

```powershell
npm ci
npm run demo
npm run dev
```

Открыть http://localhost:3000, редакция — http://localhost:3000/editorial. В VS Code открыть `science-portal.code-workspace`. Ключи не нужны для demo; копировать `.env.example` следует только при подключении worker к сервисам.

```powershell
npm run typecheck
npm test
npm run build
```

## Что уже работает

- Next.js: портал, карточка истории с evidence, редакционный интерфейс и storyboard, политика редакции, health endpoint.
- Офлайн-прогон fixture: JSON-досье, журнал стадий, SRT. `artifacts/demo` создаётся командой `npm run demo`.
- Типизированные сущности, DomainPack, проверки provenance и допуска к публикации, нормализация DOI/arXiv.
- Gemini REST adapter со structured JSON output и Zod-проверкой, пока вне live workflow.
- Supabase SQL: сущности, RLS, приватный bucket, очередь с идемпотентностью, lease, retry/backoff.
- Worker обрабатывает `normalize_source`; неизвестные стадии переводит в `held`.
- Технический FFmpeg preview: `npm run video:render` создаёт тихий MP4 с субтитрами, если установлен FFmpeg с libass. Это не готовое научное видео.

## Что ещё нужно реализовать

Реальные ingestion/research/verification, Supabase Auth и серверные права редактора, сохранение решений UI, атомарный бюджет, TTS и полный монтаж, OAuth/upload YouTube. Они разбиты на проверяемые задачи в `docs/BACKLOG.md`. До подключения Auth показывать в UI можно только fixture. Никаких платных API-вызовов, публикаций или облачных ресурсов этот каркас сам не создаёт.

## Структура

```text
apps/web          Next.js для Vercel: портал + demo редакции
apps/worker       отдельный background process, Dockerfile
packages/core     модели, схемы, DomainPack, release gate
packages/sources  идентичность источников
packages/llm      Gemini adapter + ModelAdapter
packages/pipeline исследование: контракт, prompt; demo workflow
packages/storage  Supabase worker repository
packages/video    timeline, SRT, FFmpeg preview, Voice/YouTube interfaces
supabase          migrations, seed, access tests
docs              единый HLD, решения, backlog, запуск
tests             meaningful release/LLM/input/timeline tests
```

## Документы

- [HLD](docs/HLD.md): согласованная архитектура и границы MVP.
- [Реализация](docs/IMPLEMENTATION.md): что подключено и как развивать.
- [Backlog](docs/BACKLOG.md): задачи для агентных сессий с DoD.
- [Решения и вопросы](docs/DECISIONS.md): подтверждения пользователя и оставшиеся выборы.
- [Проверки](docs/VALIDATION.md): фактические результаты этой сессии.

## Supabase и Vercel

Supabase CLI и Docker устанавливаются отдельно. Из корня проекта: `supabase start`, затем `supabase db reset` и `supabase test db`. Для удалённого проекта сначала проверить target, затем применять migration через обычный CLI workflow. Никакие удалённые миграции в этой сессии не применялись.

Vercel: добавить репозиторий, Root Directory `apps/web`, framework Next.js, Install Command `cd ../.. && npm ci`, Build Command `npm run build`. Разрешить доступ к файлам вне Root Directory для workspace packages. Внешний worker запускается отдельно, не через Vercel Functions. Подробности — `docs/IMPLEMENTATION.md`.

CI рассчитан на репозиторий с корнем в этой папке. Если сохранять проект подпапкой другого репозитория, перенести workflow в корневую `.github/workflows` и задать `working-directory`/`cache-dependency-path`.
