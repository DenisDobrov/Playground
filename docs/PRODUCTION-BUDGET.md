# Бюджет производства — PR6

## Цель и границы

По уточнению пользователя приоритет — инструменты анализа новостей, контента, голоса и видео. Этот срез даёт атомарный ledger, экран редактора и локальные инструменты планирования/разбора метаданных. Он не запускает платный research, сравнение verifier или платные AI/TTS/render API. Наличие ledger само по себе не включает такие вызовы. Публичный выпуск по-прежнему требует evidence, научных/языковых проверок, прав и approvals.

Четыре категории: `news_analysis`, `content`, `voice`, `video`. ES/EN проходят как отдельные оплачиваемые текстовые операции одного сюжета. Voice и render относятся к конкретным story ID и video key; версия video key обозначает один выпуск, а scene input hash — конкретную работу внутри него. Нельзя выдавать каждому сценическому заданию новый video key, обходя лимит выпуска.

## Контракт ledger

- USD microdollars: 1 USD = 1 000 000 целых единиц. Стоимость по единицам округляется вверх; float-арифметика для начисления не используется.
- Месячный UTC план и лимиты категорий/сюжета/видео задаются до reserve. В v1 все лимиты относятся к выбранному месяцу, а не lifetime cap на сюжет. Исторические операции сохраняются. Без плана dispatch не разрешён. План неизменяем: одинаковый init идемпотентен, другой требует отдельного review/механизма изменения, а не тихой перезаписи.
- Ключ идемпотентности связан с месяцем, категорией, story/video, стоимостью, tool/version, price version и input hash. Совпадающий ключ с другими входами — ошибка. Для изменения narration/scene/voice нужны новые input hash и ключ, сохраняя общий video key выпуска.
- Все изменения блокируют строку месячного плана до расчёта обязательств. Reserve/start требуют READ COMMITTED, как у обычных PostgREST RPC; другие isolation levels отклоняются до dispatch, чтобы не считать остаток по старому snapshot. Конкурентные reserve не превышают остаток; конкурентные start выдают ровно один execution token.
- Reserve держит верхнюю оценку. Start фиксируется **до** внешнего запроса. Settle заменяет резерв фактической суммой и сохраняет usage + receipt/artifact reference. Повтор идентичной квитанции не списывает второй раз; другая квитанция на тот же результат отклоняется.
- Неотправленный резерв живёт 10 минут; следующий новый reserve освобождает истёкшие неотправленные операции. Явный release допускается только до start. Истёкший резерв нельзя использовать для dispatch.
- После start неопределённый результат сохраняет весь резерв. Истечение 30 минут переводит started в uncertain при следующем reserve, но **не освобождает деньги**. Время не доказывает отсутствие счёта.
- Фактический счёт выше резерва записывается полностью. Новые reserve и start ранее зарезервированных работ проверяют лимиты с учётом перерасхода. Уже отправленные запросы нельзя отменить бухгалтерской записью.

| Состояние | Деньги | Следующее действие |
|---|---|---|
| reserved | оценка удержана | start или release до отправки |
| started | оценка удержана | settle; при неопределённости — uncertain |
| uncertain | оценка удержана | сверка receipt/usage и settle |
| settled | фактическая сумма учтена | вернуть сохранённый результат, не повторять вызов |
| released | удержание снято | проверить основание перед новой попыткой с новым ключом |

`executeBudgeted` — общий worker contract для будущих AI/TTS/render adapters. При повторе started/settled/uncertain операция возвращается held; сеть повторно не вызывается. Сбой callback или неоднозначный ответ settle не освобождает резерв. Если ответ start потерян, внешняя операция не отправляется; reservation проверяется администратором. Callback обязан сохранить artifact и digest до возврата receipt reference; SQL ledger не хранит аудио/видео или модельный текст. Кэш проверяет файл/checksum отдельно, не считает settled доказательством наличия bytes.

Не обещаем exactly-once delivery внешнему сервису. До подключения каждого провайдера нужны bounded input/output/runtime, актуальная tariff card, metering всех billable units (включая reasoning/cache, если применимо), receipt/reconciliation и поддерживаемый им idempotency key. Иначе задачу удерживать. Существующий низкоуровневый Gemini adapter ещё не подключён к платному worker: его нельзя считать автоматически защищённым этим wrapper. `worker:once` по-прежнему выполняет только normalize_source.

## Локальные команды

Нужны migrations до 008 и `.env.local-worker` от `db:local:env`. CLI принимает только API `http://127.0.0.1:56321`. Он не имеет cloud режима.

```powershell
npx supabase migration up --local
npm run budget:local:init
npm run budget:local:recover
npm run production:local:plan -- config/production-input.example.json
npm run budget:local:review -- <story-uuid>
npm run budget:local:rehearse -- <story-uuid>
```

`config/production-budget.example.json` — инженерный план на $200: анализ $30, текст/сценарий $50, голос $50, видео $70; на сюжет/месяц $10, выпуск/месяц $25. Это распределение резерва, не рыночный расчёт и не подключение оплаты. Можно передать собственный JSON в `budget:local:init -- path.json` **до первого init месяца**. Подписки инфраструктуры, домены и человеческое время пока считаются отдельно по HLD.

`production:local:plan` принимает явные token ceilings, полный narration ES и runtime ceiling рендера. Вторым аргументом можно передать свою reviewed price card с `version`, `expiresAt` и `rates` для input_tokens/output_tokens/characters/render_ms в microdollars per million units. Отсутствующий/устаревший тариф не подменяется нулём. Без карты все цены — null. Не сравнивать video duration с billed render runtime; единицы биллинга TTS сверить до подключения. Пример narration короткий и не является пилотом 6–8 минут.

`budget:local:review` читает сохранённые title/identifiers/flags, делает deterministic metadata brief и сохраняет artifact в ignored `artifacts/production`. Он требует первоисточник для NASA, не создаёт claims, не выбирает новости вместо человека и не выполняет научную верификацию. В ledger фиксируется local-metadata-review с нулевым provider charge. Повтор отдаёт прежнюю operation identity без новой работы.

`budget:local:rehearse` проверяет четыре пути учёта на явно synthetic zero-charge callbacks. Он **не создаёт голос, текст статьи или MP4**. Не выдавать rehearsal за полный production run. Реальные счета, токены, символы и длительности появятся только от подключённых metered adapters.

В live local редакции открыть `/editorial/budget`: суммы, категории, последние операции, количество неопределённых списаний/перерасходов. Есть просмотр месяца; financial write forms отсутствуют. И editor, и reviewer могут читать, но не изменять лимиты/квитанции. Из web нет service-role key. Аноним/outsider не видят ledger. На базе без migration 008 показано сообщение о настройке, без fake success.

`budget:local:recover` освобождает только неотправленные истёкшие резервы текущего месяца и помечает просроченный started как uncertain, сохраняя деньги. Можно передать прежний месяц YYYY-MM-01 после rollover. Та же процедура вызывается внутри reserve; если reserve отклонён, вся его транзакция откатывается. Recovery не проверяет счёт провайдера и не повторяет tool call.

## Сверка после сбоя

1. Остановить автоматические повторы конкретного ключа; найти operation ID, artifact и provider request/receipt.
2. Проверить фактическую оплату и все units у провайдера. Сохранить квитанцию/артефакт с checksum в доверенном worker storage.
3. Из административного worker-контекста вызвать `budget_settle(id, execution_token, actual_micros, usage, reference)`. Нулевой actual допустим только после подтверждения отсутствия счёта; timeout таким подтверждением не является.
4. Если результата нет, но счёт есть — учесть счёт, удержать задачу для явного решения о новой попытке. Новый attempt key не должен молча появляться в retry loop.

Операторская UI сверки и автоматический provider reconciliation пока не реализованы. RPC намеренно доступны только service_role; default function privileges и RLS проверяются SQL-тестами. Legacy shared cloud Auth и данные не менялись; migration 008 пока только локальная, как и 005–007.

## Ближайшие реализации

1. Анализ кандидатов → понятный brief и предлагаемые причины отбора с отдельным human decision; затем ES/EN draft и video outline. Метаданные не заменяют evidence.
2. Один TTS adapter, короткие ES samples и pronunciation lexicon, сохранение audio/checksum/реальной длительности и metered receipt. Провайдер и голос выбираются до полного платного выпуска; тарифы проверяются в момент подключения.
3. Remotion scene templates + FFmpeg assembly на тестовом тексте, narration/captions, scene cache и права assets. Это можно проверить до готовности научной публикации; выпуск реальной новости всё равно проходит release gates.
4. Paid deep research/verifier benchmark отложены до содержательного gold set и отдельного ограниченного прогона. Они не являются ближайшей задачей после этого PR.
