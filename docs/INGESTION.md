# Источники и английская версия — первый рабочий срез

## Что можно проверить автоматически

CI проверяет типы, release contracts, RLS/права, immutable revisions, очередь и её конкурентные сессии. HTTP integration запускает собственный Next и проверяет настоящий локальный magic link/PKCE, refresh/logout, сохранение решения, CSRF, повторные запросы, stale tab и отзыв membership. Теперь также проверяет серверный HTML language EN/ES, английские страницы и 404 вместо подстановки испанской статьи.

Live metadata smoke отдельно выполняется оператором, не в CI: внешние endpoints могут быть недоступны, это не причина делать CI зависимым от их доступности. Платные модели не вызываются.

## Registry и команды

Разрешены только `arxiv-ai`, `arxiv-physics`, `nasa-news`. URL нельзя передать через CLI или feed item. arXiv: cs.AI/cs.CL/cs.LG и hep-ex/gr-qc/astro-ph.CO/quant-ph; ответы до 21 и 9 записей. NASA news releases — discovery, до 20 записей без обязательства заполнить квоту. Институтский релиз не равен первичной научной публикации.

```powershell
npm run sources:ingest:local -- arxiv-ai
npm run sources:ingest:local -- arxiv-physics
npm run sources:ingest:local -- nasa-news
npm run gold:export:local
```

Нужны локальные migrations 005–007 и `.env.local-worker`, созданный `npm run db:local:env`. Между arXiv прогонами выдерживать минимум 3 секунды; если lease/cooldown занят, команда выдаёт `feed.deferred`, а не запускает ещё одно соединение. `sources:ingest` читает cloud env и используется лишь после отдельного подключения reviewed migrations; в этом срезе cloud ingestion не запускался.

Состояние provider lease и cooldown хранится в Academy DB, arXiv категории разделяют один lock. Запускать live poller только в одной среде: локальная и облачная БД не образуют общий rate limiter. При HTTP 429/503 сохраняется Retry-After; при ошибке пауза 60 секунд. Нет мгновенного retry loop и автоматического расписания. Следующий разрешённый запуск повторяет idempotent intake. ETag/Last-Modified обновляются только после успешного разбора и сохранения всех entries; частичный batch можно повторить, повтор не создаёт новый сюжет. HTTP 304 обновляет checked_at, сохраняя предыдущие content dates.

Транспорт: фиксированные HTTPS endpoints, DNS lookup проверяет адрес реального соединения; private/reserved IPv4 и IPv6 запрещены. Redirects не следуются. Timeout 20 секунд, XML до 2 MB, DTD/entities запрещены. Feed item URL не загружается. Не скачиваются PDF, изображения, аудио, полные статьи или NASA content body. Строки источника — untrusted input, не агентные инструкции.

Первичные документы: [arXiv API manual](https://info.arxiv.org/help/api/user-manual.html), [arXiv API rate limits](https://info.arxiv.org/help/api/tou.html), [NASA RSS registry](https://www.nasa.gov/rss-feeds/). Проверены 22.10.2026: arXiv требует не чаще 1 запроса/3 секунды и одно соединение для всех машин оператора вместе; published — первая версия, updated — обновление. Эти даты сохраняются отдельно.

## Идентичность и свежесть

Миграция 005 добавляет feed state/locks и source aliases. DOI, сообщённый arXiv metadata, связывается с arXiv identity; конфликт существующих identities останавливает intake для review, не сливает статьи автоматически. Ручной DOI после импорта arXiv переиспользует тот же Source/Story. Metadata не означает verified claim, peer review, full-text access или права на figure.

Хранятся originalPublishedAt, revisionAt, pressReleaseAt и fetchedAt. Порог старой работы — 180 дней, это инженерная гипотеза, не научное правило. Большой разрыв между оригиналом и релизом → rehash; старая первая версия при свежем fetch → older_original; неизвестная дата/будущая дата/обратный порядок версий требуют review. Feed freshness считается по датам entries, не по факту недавнего HTTP 200/304. NASA всегда требует поиска primary study. Сюжеты остаются непроверенными кандидатами, не публикуются.

## Эталон: действие человека

`gold:export:local` создаёт игнорируемый `artifacts/gold-set/candidates.json`: до 21 AI и 9 physics preprints, без выдуманных меток. Это пул для независимого отбора, **не** готовый claim-verification gold set. Не заполнять пустые human labels решениями модели.

Денис в live local inbox открывает 20–30 кандидатов и сохраняет select/reject/hold с конкретной причиной; hold можно использовать для контекстного сюжета. Не смотреть модельный ranking до независимой разметки. Экспорт повторяется после решений: selection-gold/2 включает последнюю humanLabel/humanReason, decision ID, policy version и savedHumanDecisions. Hold/revise не считаются завершёнными binary labels. Перед model eval фиксировать snapshot. Claim gold set с точными quote/locator и adversarial ошибками готовится отдельно на этапе research; метаданных заголовка для этого недостаточно. Retained/context flags не отменяют качество/права/review.

## EN/ES

Существующие испанские URL сохранены. Добавлены `/en`, `/en/method`, `/en/stories/reading-ai-results`; страницы — явная synthetic demo, не реальные новости из intake. Route groups дают отдельные server-rendered `<html lang="es">` и `<html lang="en">` и общий branding; переключение между root layouts вызывает полную загрузку страницы. Newsroom пока на испанском; видео пилота тоже ES.

Миграция 006 добавляет articles.language, прежние данные остаются ES. Уникальность — story/language/version; human approvals и publications продолжают ссылаться на exact article ID. LocalizedArticle DTO использует нейтральные text/aiDisclosure; старые физические колонки title_es/ai_disclosure_es сохраняются для совместимости. EN revision не наследует Spanish language review или approval. Release checks требуют English review/approval явно; англоязычный dossier не публикуется автоматически. EN writer и persisted release service — следующий спринт, не часть этого metadata intake.

## Облачный статус и ваша ручная проверка

По явному подтверждению пользователя migration 004 применена и membership editor назначена существующей учётке. Проверено чтением cloud journal/membership. Auth user, SMTP, templates, redirect URL, legacy objects не менялись, писем не отправлялось. Migrations 005–007 пока **только локально**, требуют review перед cloud install.

Для облачного веб-входа остаётся настройка выбранной Vercel среды по `EDITORIAL.md`: пять EDITORIAL_* variables и точный callback в Supabase redirect allowlist, сохранив старые URL. Service-role/DB URL вебу не нужны. Production browser/email delivery smoke выполняет Денис после активации; локальный Mailpit не проверяет доставку в Gmail. Обычные Preview остаются demo.

В локальном браузере проверить ES/EN переключение и формулировки, войти, открыть реальные candidates, сохранить 2–3 решения и обновить страницу. Это дополняет автоматические проверки UX и содержательным отбором, не повторяет вручную всю тестовую матрицу.

## Очередь и редакционная память

Сохранённые решения уходят из новых; все сюжеты доступны в `/editorial/stories` с поиском и фильтрами. Migration 007 и цикл Motivo → редакционная память → эталон → повторное рассмотрение описаны в `EDITORIAL-FEEDBACK.md`. Автоматический research/reanalysis ещё не подключён.
