# Три следующих спринта — 22 октября 2026

Это последовательные вертикальные срезы; ориентир 1–2 недели на спринт после согласования доступного времени, не обещание календарного релиза. Контрольная точка в конце каждого среза. Новые задачи выполнять в ветках `codex/`, один reviewable PR на самостоятельный срез. PR2–4 слиты; PR5 содержит sources/EN и доработки редакционной очереди. Автоматического merge нет.

## Спринт 1 — защищённая редакция и реальные кандидаты

**Текущее состояние:** PR2–4 слиты в master, CI master зелёный. Cloud 004 и editor membership установлены после явных согласий. В следующем PR реализованы локальные arXiv/NASA intake, даты/aliases и EN public preview. 30-кандидатный selection pool выгружен; экспорт теперь переносит реальные human labels/reasons с provenance. Очередь новых и каталог разделены; каталог имеет поиск/фильтры и сохраняет историю повторного рассмотрения. Содержательная разметка остаётся задачей редактора. Vercel live Auth activation, ручная разметка и первичные документы для claim gold set ещё впереди. Подробности — `INGESTION.md`.

**Результат:** редактор видит настоящие источники, принимает сохранённое решение; статья архитектурно не ждёт видео.

1. Принять HLD v0.3, разделить release contracts, определить scene-job identity. **Начато в текущей ветке:** чистые проверки и тесты; публикация и renderer ещё не подключены.
2. Supabase email magic link, server-side session verification и membership. **Реализовано и проверено локально в следующем срезе:** Auth, manual intake, persisted decisions, retry/stale-tab conflict; инструкция `EDITORIAL.md`. Cloud 004 и membership уже установлены; Vercel activation остаётся отдельным шагом. Обычный authenticated без membership не получает inbox. Editor пишет через авторизованную команду; reviewer только читает. Legacy Auth settings не менять.
3. Persisted manual DOI/arXiv inbox → allowlisted arXiv ingestion + один согласованный институтский feed. Dedupe и normalize job, conditional requests/лимиты, SSRF и redirects проверяются до fetch.
4. Original/revision/press-release/fetch dates, configurable rehash и stale feed flags. Недатированная работа отправляется на review. Visual potential не входит в article ranking.
5. Собрать 20–30 кандидатов, Денис независимо размечает select/reject/hold/revise; сохранить причины и версии, hold/revise оставить unresolved. Редакционная память и будущие триггеры повторного анализа — `EDITORIAL-FEEDBACK.md`. Для verifier подготовить не менее 30 атомарных примеров: корректные, unsupported, vendor claims, потеря caveats/causation, неверные цитаты/locators, abstract-only; без выдачи synthetic cases за реальные результаты.

**DoD:** аноним и посторонний authenticated не читают редакцию; решения переживают reload; повтор DOI не создаёт дубль. Даты и причина отбора видны. RLS/роль/команда проверены интеграционно. Release contract статьи не содержит зависимости от видео. Нет платных вызовов.

## Спринт 2 — доказательная статья и сравнение verifier

Уточнение языка: writer должен выпускать ES и EN как отдельные revisions из одного verified dossier. Каждая получает собственный language review/approval. Translation не наследует approval; исправление claims распространяется на оба языка. Квоты считают сюжеты, ledger учитывает обе локализации. Видео остаётся ES.

**Результат:** один реальный сюжет проходит до проверенной испанской статьи; выбран независимый verifier по измерению.

1. Atomic budget ledger: reserve → settle/release, monthly/story/video limits, idempotency и crash recovery. Два worker не превышают лимит. Все model traces хранят версии, usage/cost; секреты исключены.
2. После ledger — ограниченный blind eval Claude и OpenAI на одном gold set и одном контексте. Перед платным запуском зафиксировать актуальные model IDs, цены и максимальную сумму прогона в рамках месячного бюджета. Метрики по типам ошибок; critical unsupported acceptance — блокирующий дефект на тестовом наборе, не доказательство абсолютной точности. При неприемлемом результате оставить human review и улучшить процесс, не выбирать победителя принудительно.
3. Gemini research по доступным первоисточникам → independent verifier → skeptic → article ES → отдельная проверка смысла/заголовка. Immutable dossier/article revisions и сохранённые reviews.
4. Серверный article release service читает persisted reviews и человеческий approval точных revisions. Публичный DTO не раскрывает prompts/drafts. Исправление создаёт новую revision и публичный correction record.

**DoD:** статья выпускается без TTS/MP4; неподтверждённый claim и stale approval блокируют её. Выбор verifier обоснован протоколом, измерены cost/story и review minutes. Клиентские booleans не обходят gate. Неоднозначные повторы publication reconciled. Публичный запуск — после настройки домена и проверки применимых disclosure/прав; до этого staging/preview.

## Спринт 3 — полный видеопилот 6–8 минут

**Результат:** одно проверенное видео из опубликованного article/dossier snapshot, сначала private YouTube upload.

1. Отдельный video selection; оценка объяснимости/визуального плана и трудоёмкости, без изменения article ranking. Зафиксировать все source revisions.
2. Сравнить короткие ES voice samples, выбрать лицензированный TTS по качеству/цене. Pronunciation lexicon v1, adapter SSML/phoneme, timing по реальному audio. Выбор тембра Денисом нужен перед полной озвучкой.
3. Remotion scene templates: diagram/chart/real asset. FFmpeg final assembly/mux/captions. Проверить license eligibility renderer; бюджетный fallback — собственные SVG/диаграммы с FFmpeg. Не добавлять второй animation stack без необходимости.
4. Asset registry, provenance/rights/attribution и запрет неизвестной лицензии в timeline. Scene jobs + input hashes + сохранённые checksums outputs; cache hit проверяет файл и digest, не только запись БД. Нужны migration/worker handlers — текущий planner их не заменяет.
5. AV QA: смысл, термины, timing/captions, пустые кадры, звук, маркировка. Отдельный человеческий video approval. OAuth/resumable private upload с idempotency/reconciliation; public release требует отдельного подтверждения.
6. Измерить cost/video, cost/minute, render time, review/correction minutes. Read-only Analytics/retention с минимальными scopes после появления доступных данных; отсутствие данных показывать явно. Без изменения topic ranking.

**DoD:** полный ролик 6–8 минут, все assets с правами, источники и canonical article в описании. Исправление сцены переиспользует остальные проверенные outputs и повторяет assembly/QA/approval. Сбой видео не меняет статус статьи. Scale до 2–3×8–12 обсуждается после нескольких пилотов с измерениями.

## Зависимости и решения по ходу

- PR2–4 уже слиты. Применённые миграции не переписывать; PR5 и локальные 005–007 проходят отдельный review.
- Cloud foundation уже установлен и проверен; новый платный Supabase project не нужен. Docker остаётся локальным dev/test окружением. Для регулярного безнадзорного рендера понадобится выбранный worker host; пока локальный запуск, без добавления Google Cloud.
- Адрес редактора/membership нужен перед live Auth smoke; доступ к YouTube и выбор голоса — в спринте 3. Пароли и ключи вводить локально.
- Если объём не помещается: уменьшать число историй пилота, не убирать verifier, права, review или бюджетные ограничения. Итоговый MVP требует и статью, и видео; завершение спринта 1 не считать запуском продукта.
