# Первый деплой Dobrov Academy в Vercel

Репозиторий: `DenisDobrov/Playground`. Корень репозитория уже содержит `apps/`, `packages/` и `package-lock.json`; локальная папка `science-portal` не является дополнительным уровнем в GitHub.

## На экране импорта

Vercel распознал `apps/web` и Docker worker. Выбрать **Import single project** в строке **web / Next.js**. Это разворачивает веб-приложение отдельно. Для текущей реализации worker оставить локальным до настройки Supabase/очереди и выбора среды фонового выполнения.

| Поле | Значение |
|---|---|
| Team | Ваш существующий аккаунт/team |
| Project Name | `dobrov-academy` |
| Root Directory | `apps/web` |
| Application / Framework Preset | `Next.js` |
| Install Command | `cd ../.. && npm ci` |
| Build Command | `npm run build` |
| Output Directory | Стандартное значение Next.js, не `out` и не `dist` |
| Node.js | `24.x` |
| Environment Variables | Пока не нужны |
| Production Branch | `master` — существующая основная ветка |

Команды install/build уже записаны в `apps/web/vercel.json`. Root Directory выбирается в Vercel UI, не в этом файле. В Root Directory settings включить **Include source files outside of the Root Directory in the Build Step**, если доступно: web импортирует `packages/core`.

Брендинг находится в feature branch до слияния PR. Для первого production deploy с новым брендом слить PR в `master`; deployment preview feature branch можно использовать для визуальной проверки до слияния.

Источники настройки: [Vercel monorepos](https://vercel.com/docs/monorepos), [доступ к workspace files](https://vercel.com/docs/monorepos/monorepo-faq), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## После Deploy

1. Сборка должна завершиться без БД и API keys: текущее приложение работает на synthetic fixture.
2. Проверить `/`, `/editorial`, `/politica`, `/icon.svg` и `/api/health`.
3. `health` должен вернуть `mode: demo` и `publicationEnabled: false`.
4. Маркировка demo и запрет индексации остаются до настоящего контента. Наличие рабочего домена не превращает fixture в новости.
5. В Project Settings проверить Git production branch и workspace source access.

Если import выбрал Services/корень `./`, вернуться к single project `web` либо изменить Root Directory на `apps/web` и preset на Next.js. Если `npm ci` сообщает об отсутствии lockfile — проверить install override: lockfile лежит на два уровня выше web. Если не находится `@science/core` — проверить workspace source access и установку из корня.

## Домены — следующий шаг

После успешного preview добавить `dobrov.org` в **Project Settings → Domains**. DNS records взять из фактических инструкций Vercel для конкретного домена; не копировать произвольный IP из старых руководств. Дождаться проверки DNS и TLS. Затем добавить `www.dobrov.org` и дополнительный `dobrow.org` с redirect на основной `dobrov.org`; при необходимости также `www.dobrow.org`.

Когда primary domain реально работает, добавить canonical origin в metadata и проверить все redirects. Сейчас canonical origin намеренно не задан, чтобы preview не ссылался на ещё не подключённый домен. Base URL для social images берётся из `VERCEL_URL` текущего deployment; локально используется localhost.

## Supabase — после первого веб-деплоя

Docker пользователь уже запустил. Это позволит отдельно перейти к локальному Supabase и проверке migration/queue. В рамках брендинга база не меняется. Текущий web не требует service-role key; ключи Gemini и worker не добавлять в публичные переменные Vercel.
