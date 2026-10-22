# Supabase для Dobrov Academy — PR2

## Решение пользователя

Используем уже существующий облачный **To-do-Db-project**, project ref `upwrplsgunjanragbggb`, регион со скриншота `us-east-2`. Новый облачный проект и платная подписка для PR2 не требуются. Старое приложение может продолжать использовать свою базу.

Наш namespace — **academy**, приватный Storage bucket — **dobrov-academy-assets**. Настройки Auth, пользователи, legacy schema и её migration history не переопределяются. Это разделение объектов, а не отдельная граница безопасности: Auth, project API keys, service role, квоты и ресурсы остаются общими с прежним приложением. Поэтому существующий service-role key старого приложения также имеет административный доступ к Academy.

Supabase поддерживает [custom schemas через Data API](https://supabase.com/docs/guides/api/using-custom-schemas). В PR2 выдаются узкие grants и RLS, а не широкие grants из общего примера документации.

## Локальная разработка

Docker уже запущен. Другие проекты занимают порты 543xx; наш локальный project ID — `dobrov-academy`, диапазон — 563xx:

| Сервис | Адрес |
|---|---|
| API | `http://127.0.0.1:56321` |
| Postgres | `127.0.0.1:56322` |
| Studio | `http://127.0.0.1:56323` |
| Тестовая почта | `http://127.0.0.1:56324` |

CLI закреплён в devDependencies. Из корня проекта:

```powershell
npm ci
npm run db:start
npm run db:test
npm run db:test:integration
npm run db:local:env
npm run worker:local:enqueue -- 2401.12345
npm run worker:local
```

`db:local:env` создаёт игнорируемый `.env.local-worker` и не перезаписывает облачный `.env`. CLI-ключи не выводятся этой командой в журнал. Повторный enqueue того же DOI/arXiv возвращает то же задание. Worker поддерживает `normalize_source`; остальные стадии остаются `held`.

`npm run db:status` показывает локальные параметры, включая тестовые ключи — не копировать его полный вывод в публичные issue. `npm run db:stop` останавливает только наш локальный проект. Для пересоздания исключительно нашей тестовой базы можно отдельно выполнить `npx supabase db reset --local`, предварительно проверив текущую папку; это удалит её локальные данные.

Никогда не использовать `db reset --linked`, `--db-url` или массовый Docker cleanup для подключения старой облачной базы. Не менять конфиг и контейнеры `soluter-ai-app`/других проектов.

## Подключение старого облачного проекта

1. В Dashboard открыть именно To-do-Db-project → **Connect**. Взять direct connection либо **Session pooler, port 5432**; transaction pooler 6543 для installer не подходит.
2. Скопировать `.env.example` в `.env` или `.env.local`, если файла ещё нет. Заполнить локально `SUPABASE_DB_URL`, `SUPABASE_URL=https://upwrplsgunjanragbggb.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY`. Worker/installer читают оба файла; `.env.local` имеет приоритет. Пароль с особыми символами должен быть URL-encoded. `SUPABASE_DB_SCHEMA=academy`.
3. Сначала запустить **только чтение**:

```powershell
npm run db:remote:plan
```

План проверяет project ref, существующий namespace/bucket, таблицы и storage policies; строки legacy-таблиц не читаются. Новые объекты на этом шаге не создаются. TLS проверяется; если требуется CA, указать путь к сертификату в `SUPABASE_DB_CA_FILE`, не отключать проверку.

4. Проверить inventory и pending migrations. Если `academy`/bucket уже заняты или действуют storage policies, установка останавливается для разбора. Любая старая storage policy может давать доступ к новым bucket, поэтому автоматического принятия таких политик нет.
5. Применение, когда preflight прошёл:

```powershell
npm run db:remote:apply -- --project-ref=upwrplsgunjanragbggb
```

Installer создаёт Academy в одной транзакции под advisory lock. Он сохраняет структурный preflight в игнорируемом `artifacts/database`, сверяет applied checksums, ведёт собственный журнал `academy.install_migrations`. Ошибка откатывает транзакцию. Existing `supabase_migrations.schema_migrations` и запись старого `remote_schema` не редактируются.

Это **не** `supabase db push`: у старого приложения уже есть своя история миграций. Исходные две scaffold migrations до PR2 ещё не устанавливались в облако, поэтому они переведены из `public` в `academy` до первого подключения. Если вы ранее применяли их вручную — остановиться и согласовать перенос, не пытаться повторно выполнить изменённые файлы. После первого успешного cloud install менять существующие migrations нельзя: только новые файлы.

6. В **Project Settings → Data API → Exposed schemas** добавить `academy`, сохранив уже перечисленные схемы. Не удалять `public` или схемы старого приложения. Это отдельная настройка доступа к API; SQL installer её не меняет автоматически.
7. Проверить `npm run worker:enqueue -- 2401.12345`, затем `npm run worker:once`. Это создаёт только Academy job, без платных AI calls.

Изменения проектных Auth URL, SMTP и providers потребуются на следующем срезе редакции; их нельзя менять без учёта старого приложения. Учётка старого пользователя сама по себе не даёт editor membership в Academy.

## Vercel и окружения без второго облачного проекта

- Local web/worker → отдельный локальный Docker Supabase.
- Выбранная стабильная облачная среда → существующий To-do-Db-project / `academy`.
- Обычные PR Preview пока остаются fixture/demo. Рабочие секреты общей облачной базы не выдаются каждой тестовой ветке.
- `SUPABASE_DB_URL` нужен только локальному installer/доверенному migration runner; не добавлять его в web client.
- Web в PR2 всё ещё demo и не требует service-role key в Vercel. Подключение UI и Auth — следующий PR.
- После PR2 добавлен opt-in live editorial slice, инструкция — `EDITORIAL.md`. Web использует publishable/anon key с пользовательской сессией; migration 004 сначала проверена локально. В этой реализации cloud Auth, SMTP и redirect settings автоматически не меняются.
- Рендер MP4 лучше хранить вне Postgres, с ограниченным сроком хранения и удалением временных файлов; фактические Storage/egress лимиты проверять по Dashboard перед видеопилотом.

## Тесты и текущие границы

`db:test` проверяет RLS, видимость published/draft, membership, запрет browser writes, immutable revisions, RPC grants и basic lease flow. `db:test:integration` использует жёстко заданный local port 56322 и проверяет две конкурирующие сессии, dedupe, crash/reclaim, stale lease, heartbeat RPC, backoff и attempts. Он не читает remote URL из env.

Cloud plan/apply требует connection string пользователя. Отсутствие credentials не мешает собрать PR и проверить всё локально, но не подтверждает установку в To-do-Db-project.
