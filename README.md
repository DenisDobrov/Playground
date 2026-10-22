# Dobrov Academy · научный портал

Единое ядро AI-редакции → статьи на испанском и английском + испанское видео с доказательствами. Бренд **Dobrov Academy**, подпись **Ciencia con evidencia.** Основной планируемый домен — **dobrov.org**, дополнительный — **dobrow.org**. Домены ещё не подключены. Английское preview: `/en`.

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
- [Ближайшие три спринта](docs/SPRINTS.md): порядок реализации, зависимости и критерии готовности.
- [Оценка замечаний к HLD](docs/HLD-REVIEW.md): что принято, уточнено и не подтверждено.
- [Реализация](docs/IMPLEMENTATION.md): что подключено и как развивать.
- [Защищённая редакция](docs/EDITORIAL.md): локальный magic link, роли, сохранённые решения и подключение live среды.
- [Источники, эталон и EN/ES](docs/INGESTION.md): ingestion, проверки дат, пул для разметки и разделение автоматических/ручных проверок.
- [Backlog](docs/BACKLOG.md): задачи для агентных сессий с DoD.
- [Решения и вопросы](docs/DECISIONS.md): подтверждения пользователя и оставшиеся выборы.
- [Проверки](docs/VALIDATION.md): фактические результаты этой сессии.
- [Брендинг](docs/BRAND.md): название, палитра, логотип и правила использования.
- [Деплой в Vercel](docs/VERCEL.md): точные поля первого импорта и порядок подключения доменов.
- [Supabase / PR2](docs/SUPABASE.md): использование существующего To-do-Db-project, namespace academy и локальные команды.

## Supabase и Vercel

Docker запускается отдельно; Supabase CLI закреплён в зависимостях проекта. Локально: `npm run db:start`, `npm run db:test`, `npm run db:test:integration`. Порты 563xx не конфликтуют с уже работающими проектами. Для облака используем существующий **To-do-Db-project** с отдельной схемой `academy`: сначала `npm run db:remote:plan`, затем проверенное применение по инструкции [SUPABASE.md](docs/SUPABASE.md). Старую облачную базу не сбрасывать и её историю миграций не заменять.

Vercel: добавить репозиторий, Root Directory `apps/web`, framework Next.js, Install Command `cd ../.. && npm ci`, Build Command `npm run build`. Разрешить доступ к файлам вне Root Directory для workspace packages. Внешний worker запускается отдельно, не через Vercel Functions. Подробности — `docs/IMPLEMENTATION.md`.

CI рассчитан на репозиторий с корнем в этой папке. Если сохранять проект подпапкой другого репозитория, перенести workflow в корневую `.github/workflows` и задать `working-directory`/`cache-dependency-path`.

### Бюджет производства (PR6)

Локальная редакция: `/editorial/budget`. Ledger учитывает news analysis, текст/сценарии, голос и видео. Команды `budget:local:init`, `budget:local:review`, `production:local:plan`; контракт, лимиты и сверка — [docs/PRODUCTION-BUDGET.md](docs/PRODUCTION-BUDGET.md). Платные сервисы этим не включаются.
