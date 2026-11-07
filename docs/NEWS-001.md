# NEWS-001 — простой новостной выпуск

Статус: реализация и приёмка. Production-результаты фиксируются отдельно; локальные тесты не означают публикацию.

## Контракт

- `news-release/1`: immutable original batch/hash → immutable EN/ES + sources, access level, dates, changes and channel text → one exact-package decision → two public release snapshots and nine scoped delivery records.
- Редактор видит две основные кнопки, необязательный комментарий и два checkbox. Комментарий может быть пустым. Один RPC атомарно сохраняет всё; optimistic version + request UUID защищают от stale/replay.
- Reviewer читает; intake/selection/news writes остаются editor-only. Anonymous читает только выпущенные DTO. Service-role не попадает в web; trusted import — локальный operator/worker CLI.
- Новая версия сбрасывает решение, сохраняя owner flags/comment. Старые опубликованные версии и решения неизменяемы. Никакие scientific review или claims.status не повышаются.
- Отказ отменяет pending/blocked/failed доставки. Уже отправленные и ambiguous/in-flight показываются для сверки/коррекции; удаление не имитируется.
- Истёкшая отправка становится uncertain и не reclaim-ится. Remote ID, URL, доказательство проверки и время сохраняются в append-only delivery events. Общая исследовательская очередь не включается.
- `Suggested for Video` true для 2,7,16, источник ai_suggested. Science Publication false без конкретной исследовательской идеи. Флаги ничего не запускают.

## Первая подборка

Период фиксирован: 1–7 ноября 2026; номера 1–17. Рюгу — более ранний контекст, продуктовые заметки — не новости. Исходный обзор и подготовленные пакеты сохраняются в приватном ignored `artifacts/news-001`. SHA256 оригинала: `bc8b3e2b4e123b6117b2f29d17c729ba8089e2b18e758b10b73010df90d7624f`.

Тексты подготовлены средствами Codex, с проверкой первоисточников; внешние model API calls: 0. Нет фиктивных Gemini usage/receipts. Оговорки о мышах, препринтах, vendor benchmarks, аналогах горизонта и мощности нагрева сохранены. Material diff хранится для №12 (более осторожное описание демонстрации) и №17 (пережившие первый год трансплантации).

Первое batch-разрешение хранит hash исходного задания, existing owner ID и origin `owner_batch_instruction`; это не фиктивный UI click. Для следующих выпусков действует обычное решение карточки. Повтор batch-команды не отменяет явный reject.

## Интерфейс и публикация

- `/editorial/news`: новые; `?view=all`, `video`, `science`: каталог и идеи. `/editorial/intake` сохраняет прежний manual intake.
- `/noticias/[slug]`, `/en/news/[slug]`: реальные approved snapshots; `/semana/2026-11-01`, `/en/week/2026-11-01`: выпуск.
- Canonical/hreflang, lang, Open Graph и sitemap относятся к опубликованным новостям. Fixtures, editorial, research и drafts остаются noindex.
- Public клиент анонимный, без cookie и service-role. Ошибка БД не заменяется демонстрационными историями.
- `/api/health` сообщает только liveness; `/api/readiness` отдельно различает news status и замороженные scientific/video modes.

## Проверки

`npm run typecheck`, `npm test`, `npm run demo`, `npm run build`; `npm run db:test`; queue/budget/review/metadata/research/news integration и HTTP Auth/Server Action checks. News integration использует только local 56322 и откатывает synthetic fixtures. Не использовать demo как доказательство реальной публикации.

## Развёртывание и rollback

Только добавочная scoped migration 015 после проверки journal/checksums, Academy-only backup и отдельной проверки восстановления. Не запускать накопленные migrations автоматически; 013 не нужна для news release. Существующие shared Auth, legacy tables, DNS/почта и роли не меняются.

До rollout: review diff + зелёные CI/Preview. При регрессии вернуть предыдущий Vercel deployment `dpl_DEw4ExvpNxNWgLnBc2T2N7EUnYK2` / `7bb34a9542754e06c3b623140d4a4cc05f48fa7f`. Добавочные таблицы оставить для сохранения истории; не удалять published records или внешние посты автоматически. Outbox остановить, неопределённые отправки сверить до любых повторов.

## Границы

Первый выпуск готовится доверенным оператором, без платной генерации. Наличие учётной записи не означает наличие API-доступа. Реальные browser deliveries и API automation отмечаются раздельно; канал без write access остаётся blocked. WhatsApp Business с личными чатами не используется вместо публичного Channel.

Новостная очередь не принимает script/TTS/video/Shorts/manuscripts или `all`. PR18/artifacts сохраняются. Полезная генерация/версии/mapping/ledger/receipts PR11 должны быть сохранены до его закрытия как superseded.
