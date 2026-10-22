# Защищённая редакция — первый рабочий срез

Актуальный статус: PR4 слит, cloud migration 004 и editor membership применены после явных подтверждений пользователя. Cloud SMTP/redirect настройки и Vercel env не менялись. Для нового source/EN среза migrations 005/006 пока только локальные; не применять все pending migrations без review. `INGESTION.md` содержит текущие границы.

В live mode `/editorial` проверяет сессию через Supabase Auth и текущую membership в `academy.editor_members`. Editor добавляет DOI/arXiv и сохраняет select/reject/hold/revise с причиной. Reviewer только читает. Пользователь без membership не видит inbox, даже если уже зарегистрирован в старом приложении. Public portal остаётся синтетическим preview.

## Локально

Из корня `science-portal`, при запущенном Docker:

```powershell
npm run db:start
npx supabase migration up --local
npm run web:local:env
npm run web:local:editor -- your-email@example.com
npm run web:local
```

Открыть `http://localhost:3000/login`, запросить ссылку и открыть письмо в локальном Mailpit `http://127.0.0.1:56324`. Переходить по ссылке в том же браузере: PKCE verifier хранится в cookie. Локальная почта не отправляется в настоящий email inbox. Bootstrap создаёт локальную учётку/роль и добавляет адрес в `.env.local-web`; при изменении env перезапустить Next. Для read-only учётки добавить аргумент `reviewer` после email.

`web:local` и `web:local:start` загружают env через Node `loadEnvFile()` в launcher. Не запускать Next dev через `node --env-file=...`: установленная версия Next переносит этот аргумент в дочерний `NODE_OPTIONS`, где Node его запрещает. Исправление не требует изменения системных переменных или повторной генерации локальных настроек.

`web:local:env` создаёт отдельный игнорируемый `.env.local-web`; root cloud `.env.local` не меняется. Повторная генерация создаёт исходный allowlist заново: затем снова выполнить `web:local:editor` для своих адресов. Не использовать bootstrap для облачной базы: URL/порт жёстко ограничены локальным проектом.

## Конфигурация выбранной live среды

| Переменная | Назначение |
|---|---|
| `EDITORIAL_MODE` | `live`; без этого интерфейс остаётся synthetic demo |
| `EDITORIAL_SUPABASE_URL` | URL нужного Supabase project |
| `EDITORIAL_SUPABASE_PUBLISHABLE_KEY` | Publishable либо legacy anon key, **не secret/service-role** |
| `EDITORIAL_SITE_URL` | Точный origin приложения без пути и завершающего `/`, например `https://dobrov.org` |
| `EDITORIAL_EMAIL_ALLOWLIST` | Адреса приглашённых, через запятую; пустой список не отправляет login links |

Переменные читаются на сервере. Browser Supabase client не используется; сессионные cookies HttpOnly, SameSite=Lax, Secure в HTTPS. Proxy обновляет сессию и передаёт cookies в ответ; page/action отдельно проверяют пользователя и актуальную DB role. Редакционные ответы `private, no-store`, callbacks без внешних redirect URL. Публичный ключ не расширяет RLS-права.

Обычные Vercel PR Preview оставить в demo. Root DB URL и service-role key в web/Vercel не нужны. Migration 004 и membership пользователя уже установлены; новые pending migrations применяются отдельно после review. До подключения домена EDITORIAL_SITE_URL должен быть фактическим Production URL Vercel, например `https://<project>.vercel.app`. Показанный в таблице `dobrov.org` используется только после DNS/доменного подключения. Не изменять существующие роли/пользователей старого приложения.

Для magic link добавить **точный** `https://<выбранный-host>/auth/callback` в Auth redirect allowlist, сохранив прежние URL. Текущий PKCE callback работает с default ConfirmationURL email template (проверено на локальном Supabase). Общий облачный template, Site URL, SMTP и signup settings автоматически не меняются: если старый проект имеет свой шаблон, проверить совместимость отдельно. Регистрация через форму выключена (`shouldCreateUser=false`), ответ для неизвестного/запрещённого адреса одинаковый. Allowlist ограничивает отправку писем через эту форму, DB membership определяет доступ.

## Контракт записи

Новая миграция `202610220004_editorial_commands.sql` добавляет только Academy column/RPC, не переписывает ранее применённые migrations.

- `create_candidate`: только authenticated editor, canonical DOI/arXiv, Source + Candidate + links + normalize job в одной транзакции. Тот же ID возвращает тот же сюжет. Нет network fetch, выдуманной даты/лицензии или платного AI вызова.
- `record_selection`: только authenticated editor; actor из `auth.uid()`, серверная policy version, обязательная причина. Request UUID обеспечивает idempotency. `editorial_version` и row lock предотвращают overwrite из устаревшей вкладки. `approve`/publication через эту команду невозможны.
- Прямые browser INSERT/UPDATE по-прежнему запрещены. Service-role не используется вебом; SQL функции `SECURITY DEFINER` имеют пустой search_path и проверяют membership внутри.

Последние 50 сюжетов видны вместе с источником, статусом и историей решений. `select` означает очередь на исследование, а не выполненное исследование. В этом срезе intake ручной и original date явно pending. Автоматические feeds, проверка дат, ranking, сохранённая gold-разметка claims и live publication — следующие задачи.

## Проверка

`npm run db:test` — RLS, полномочия RPC, dedupe, authenticated actor, retry и stale-tab conflict. `npm run db:test:integration` — конкурентные lease sessions. После `npm run build`: `npm run test:editorial:web` запускает собственный Next на свободном localhost:3000 и проверяет реальный magic-link flow через локальную почту, refresh/logout, Server Actions, CSRF, persistence и права. При занятом порте тест останавливается, не переиспользует неизвестный server. Синтетические test users/data удаляются; внешняя почта и облако не используются. Этот сценарий добавлен в Database CI.

Основание: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless); bundled Next 16.4.2 guides по cookies, Proxy и Server Actions. Проверено 22.10.2026.
