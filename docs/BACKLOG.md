# Backlog агентной реализации

**Актуальный порядок ближайших трёх спринтов — `SPRINTS.md` (22.10.2026).** Ниже сохранён каталог задач с прежними S-идентификаторами, а не календарный порядок. Видео пилота 1×6–8 минут; 8–12 — цель масштабирования. Auth/manual inbox реализованы, cloud 004/membership установлены. Локальный source/EN срез и оставшиеся ограничения описаны в `INGESTION.md`. Read-only retention входит в MVP, автоматическая оптимизация — после него.

Каждую задачу выполнять отдельной сессией с чтением AGENTS.md и HLD. Сначала контракт и критерий готовности, затем реализация и проверка. Ниже задания для будущих агентов разработки; в этой сессии дополнительные агенты не запускались.

## S0 — Foundation — выполненный срез

Monorepo, типы, SQL migration, offline demo, портал/editorial UI, Gemini adapter, normalization worker, subtitle/preview renderer, CI и документация. Не считать это полным MVP.

## S1.1 — Supabase integration и durable jobs

PR2 использует существующий To-do-Db-project в схеме `academy`; локальная БД — `dobrov-academy`, порты 563xx. CLI, миграции, проверки RLS/очереди, renewal и graceful shutdown добавлены. Облачный preflight/apply подготовлен, но требует локальных credentials; точный статус проверок — `VALIDATION.md`, процедура — `SUPABASE.md`.

**Задание:** применить migration к локальной Supabase, проверить RLS на реальных ролях, очередь с двумя worker и recovery после падения, добавить renew lease и graceful shutdown. Проверить возможности хостера worker; не внедрять новое облако без решения.

**DoD:** задача берётся одним worker, stale lease не завершает новую попытку, attempts исчерпываются предсказуемо, unsupported stage held. Миграции проходят с чистого состояния, SQL tests зелёные.

## S1.2 — Source ingestion

Реализован локальный срез: allowlisted arXiv metadata + согласованный NASA discovery RSS, dates/flags, aliases/dedupe, provider leases и conditional HTTP; см. `INGESTION.md`. Реальный intake дал 21 AI + 9 physics + 1 NASA candidate; 30 препринтов выгружены для human selection labels. Не считать это full-text research, автоматическим научным ranking или готовым verifier gold set. Cloud install 005/006 и scheduler не включены.

**Задание:** реализовать arXiv по AI/physics и один институтский feed. Category allowlist, лимиты из актуальной документации источника, conditional requests, retries, canonical identity, source license metadata и dedupe. Press releases используются для discovery, primary source хранится отдельно.

**DoD:** реальные DOI/arXiv создают Source + Candidate + Job без дублей; одинаковая работа из разных фидов кластеризуется; произвольный URL/redirect в локальную сеть не загружается. Короткие цитаты и ссылки хранятся отдельно от полного текста. Согласовать конкретный registry источников.

## S2.1 — Auth и редакция

Локальный vertical slice реализован: opt-in Auth, manual inbox, persisted selection и read-only reviewer; end-to-end tests в CI. `EDITORIAL.md`. Остались cloud activation/реальный editor login smoke после review 004; публичная лента пока fixture, published DTO — в срезе article release.

**Задание:** email magic link через Supabase Auth, server-side session verification, editor membership, защищённые routes и команды. Заменить fixture repository в редакции реальной БД; публичная лента видит только published DTO.

**DoD:** anon и обычный authenticated не читают редакцию; editor получает inbox, делает select/reject с причиной; решение сохраняется после перезагрузки; действия CSRF-safe и не доверяют client role/approval flags.

## S2.2 — Ranking и эталон

**Задание:** дешёвый предфильтр, многомерный score с rationale, недельный редактор и мягкая квота AI 70% / physics 30%. Денис размечает тот же пул независимо. Версионировать правила/промпты и фиксировать расхождения.

**DoD:** можно рассчитать recall/согласие, понять причину пропуска и воспроизвести результат конкретной версии. Плохие сюжеты не добираются ради квоты. Нет оптимизации по CTR.

## S3.1 — Budget ledger и model traces

**Задание:** atomic monthly/story/video reservations в Postgres, settlement фактического usage, предотвращение double-spend при retries; AgentRun хранит model/prompt/policy/input hash/usage/cost. Выбрать доступные Gemini model IDs и проверить качество/цену на небольшом наборе.

**DoD:** два конкурентных worker не выходят за лимит; crash/resume не теряет reservation; нет paid calls без reservation; лог не содержит ключей. Ценовая конфигурация имеет дату и источник.

## S3.2 — Research, independent verifier и skeptic

**Задание:** researcher строит dossier только по доступным первоисточникам. Независимый провайдер verifier подтверждает exact quote/locator и научный смысл; skeptic ищет потерю caveats, causation/hype. Добавить separate review records вместо свободных boolean client inputs.

**DoD:** gold-set показывает ошибки на намеренно искажённых выводах; unsupported claims held; утверждения в одном domain не получают шкалу другого. Abstract-only явно маркируется и не выдаётся за full-text review. Платные calls только после S3.1.

## S3.3 — Article + Script ES

**Задание:** writer получает verified dossier и glossary; пишет article и scene-based script по одной семантической базе. Второй проход сверяет каждую ES фразу, заголовок и будущие captions с claims. Добавить редактор версий и выборочный review носителем ES.

**DoD:** новая версия не наследует approval; параграфы и сцены не добавляют фактов; есть limitations/what-next. Модели не подбирают библиографию из памяти.

## S4.1 — TTS и визуальный пакет

**Задание:** провести короткое сравнение TTS по ES, выбрать лицензированный brand voice. Visual Director составляет shot list, права/атрибуцию, authentic-first visuals и explanatory diagrams. Реализовать озвучку с фактической длительностью на сцену.

**DoD:** источник/лицензия каждого asset видны; неизвестные права блокируют выпуск; синтетическая иллюстрация маркирована; glossary произносится корректно. Замерена стоимость на минуту; один и тот же input не оплачивается дважды.

## S4.2 — Полное видео

**Задание:** заменить тихий preview на настоящий scene montage: narration, изображения/схемы, movement, captions, transitions, опциональная лицензированная музыка. Тайминги по TTS; render job с heartbeat, хранение в private bucket, signed preview.

**DoD:** одно 8–12-минутное научное видео с понятным visual style, без зависаний/пустых кадров, с readable captions и references, пригодное к человеческой проверке. Счётчик затрат и время review измерены. Это обязательная часть MVP.

## S5.1 — Release и YouTube

**Задание:** серверный release service проверяет persisted reviews, exact versions и человеческий approval. Реализовать web publication и OAuth/resumable YouTube upload сначала private. Preview approval отдельно от решения public publish. Добавить metadata/title/thumbnail checks.

**DoD:** ни client flag, ни агент не обходят gate. Повтор задачи не создаёт дубль web/video; неоднозначный timeout reconciled. В публичной статье есть evidence, AI disclosure и история. YouTube description содержит источники и ссылку на canonical web.

## S5.2 — Corrections и эксплуатация

**Задание:** immutable versions, публичная Correction, fanout по Publications, error dashboard, DLQ/held inbox, cost и quality metrics. Проверить бюджет на пилоте из нескольких полных выпусков.

**DoD:** одна исправленная claim приводит к обновлению обоих каналов; пользователь видит, что изменилось. Полный real-source → article + video путь пройден. Только после этого принимать решение о публичном запуске и следующей фазе автономии.

## После MVP

Shorts, weekly digest, Telegram/выбранные соцсети, historian citation watch, семантическая дедупликация/pgvector, улучшенный graph UI, retention analytics с ограничениями честности, дополнительные DomainPack. Медицина только с профильной политикой и экспертом.
