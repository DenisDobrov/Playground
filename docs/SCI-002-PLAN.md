# SCI-002 — Primary Source Metadata Enrichment and Pending Identity Resolution

Статус: план, реализация не начата. Основание — Source/Story/aliases и intake SCI-001. HLD, MVP scope, release gates и месячный бюджет остаются без изменений. Платные LLM не используются. Подготовка собственных научных рукописей и подача в arXiv — отдельная будущая возможность из BACKLOG.md, не часть ingestion.

## Короткий план реализации

1. **Контракт наблюдения metadata.** Сохранять immutable snapshot ответа: provider, запрос по нормализованному ID, retrieved_at, payload hash, нормализованные поля, adapter version и ошибки/конфликты. Даты, извлечённые из обзора, остаются отдельно. `metadata_confirmed` означает подтверждённые библиографические данные, а не scientific verification claims.
2. **arXiv lookup по ID.** Переиспользовать canonical IDs, XML parsing, ограниченный транспорт и общий arXiv provider lease/cooldown с feed ingestion. Получать название, авторов, категории, original/updated dates, доступные version/DOI/journal-reference поля. Обрабатывать missing/malformed metadata, 429/503 и несовпадение запрошенного ID. Никакого произвольного URL fetch или PDF crawling.
3. **Crossref DOI lookup.** Добавить ограниченный adapter для `api.crossref.org` с JSON validation, timeout/response cap, cache и provider rate-limit handling. Сверять returned DOI с requested DOI, сохранять доступные bibliographic dates/relations/updates без догадок. Created/indexed/fetched dates не выдавать за publication date. API-ответ не доказывает научную корректность работы.
4. **DOI↔arXiv identity proposal.** Предлагать link только по явным данным первичной metadata, проверенному DOI record и отсутствию противоречий. Title similarity сама по себе не основание. В MVP editor подтверждает proposal с evidence snapshot IDs и reason. В одной транзакции повторно проверять aliases, locks и expected revision. При конфликте разных существующих Source/Story — hold и ручное разрешение; не сливать records автоматически.
5. **Pending resolution без перезаписи original.** Добавить append-only resolution/link record, связывающий review item с Source/Story, snapshot IDs, actor, reason и previous resolution/version. Исходные Markdown/extraction/selected_identity остаются immutable. В редакции показать claimed vs fetched metadata, предложенную identity и конфликт; preview — read-only, confirm — editor-only с проверкой версии. Reviewer читает. Повтор команды идемпотентен; исправление resolution добавляет новую запись, сохраняя lineage.
6. **Scientific event reconciliation.** Сохранять исходные reported event UUID и provenance. Полная дата, версия или явный provider event ID могут обосновать canonical-event proposal; неизвестная дата не равна другой неизвестной дате. Недатированные SCI-001 observations остаются привязанными к разделу, пока связи не подтверждены. Отдельная append-only связь объединяет observations после проверки; не переписывать исходные даты/авторов и не менять published revisions. Значимое новое событие предлагает review, а не автоматически подтверждает выводы.

Переиспользовать production_jobs/lease worker, Source, Story, source_aliases, existing RLS/editor membership и editorial catalog/import archive. Понадобится только минимальное persistence для snapshots/resolutions и подтверждения identity proposals; конкретную migration подготовить в SCI-002 после проверки схемы. Новую инфраструктуру и сервис подписки не добавлять.

## Проверка и DoD

- Offline fixtures arXiv/Crossref: совпавший ID, отсутствующая запись, противоречивые DOI/arXiv, multiple dates, changed metadata, версия, correction/retraction relation при наличии в ответе, unsafe target, rate limit и oversized response.
- SQL/RLS: editor/reviewer/outsider; atomic alias conflict, stale resolution, repeated confirmation, immutable originals и append-only lineage.
- Integration: импорт pending section → metadata snapshots → read-only proposal → human confirmation → тот же Source/Story/alias при повторе. Независимые papers с похожим title не сливаются.
- Event tests: неизвестная дата сохраняет отдельные observations, подтверждённые date/revision/provider IDs позволяют reviewed linking, published revisions/approval не меняются.
- Полный regression suite SCI-001, очередь, бюджет, typecheck/build; network smoke отдельно и только по согласованным public metadata endpoints. 0 paid LLM calls.

Результат среза — metadata-confirmed identity и прослеживаемое разрешение pending item. Научный verifier, авторское manuscript generation и arXiv submission не входят в этот PR.

Документы провайдеров, проверенные при планировании: [arXiv API manual](https://info.arxiv.org/help/api/user-manual.html), [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/). На реализации повторно проверить текущие условия, schema и rate-limit guidance.
