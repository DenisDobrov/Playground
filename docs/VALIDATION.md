# Проверки Sprint 0

Дата: 21 октября 2026. Среда: Windows, Node.js 24.14.0, npm 11.9.0.

| Проверка | Результат |
|---|---|
| Установка зависимостей | Успешно; версии закреплены, package-lock.json сохранён |
| npm audit при install | 0 известных уязвимостей на момент установки |
| `npm run typecheck` | Успешно для packages/worker и web; web предварительно запускает next typegen |
| `npm test` | 21/21 passed |
| `npm run demo` | Успешно; bundle.json, report.json и captions.srt в artifacts/demo |
| `npm run build` | Успешно, Next.js 16.4.2; все страницы сгенерированы |
| `/api/health` | HTTP success, mode demo, publicationEnabled false |
| Browser: главная | Открывается, испанский контент, заметная маркировка fixture, визуальный осмотр |
| Browser: редакция | Переход с главной работает, dossier виден, Review tab показывает release blockers |
| Browser: review input | Ввод причины включает действия; запрос доработки отображается в текущей вкладке |
| Browser: publish | Кнопка disabled; нет publish API или live uploader |

Production build сначала упёрся в EPERM при создании Next.js `_not-found` внутри песочницы. Та же сборка вне песочницы завершилась успешно. Локальный preview также проверен после запуска вне сетевых ограничений песочницы. Внешние облачные ресурсы не создавались.

## Проверенные сценарии тестов

Блокировка synthetic release; полный reviewed contract; устаревший approval; несовпадение story IDs; несовместимая evidence scale; отсутствующая provenance; invented scene claim; текст без claims; неясные права на картинки; маркировка generated illustration; DOI/arXiv identity; запрет произвольного fetch target; budget arithmetic; SRT timing; отрицательная duration; неверный и усечённый structured output Gemini; отделение untrusted source payload от system instructions.

## Не выполнено в этом окружении

- Supabase migration/seed/SQL RLS tests и конкурентная очередь: Supabase CLI не найден, Docker Desktop engine не запущен. SQL подготовлен, но интеграционно не проверен.
- Docker build: engine недоступен.
- MP4 FFmpeg preview: FFmpeg в PATH не найден. SRT generator проверен; код запуска renderer не проверен на реальном FFmpeg.
- Gemini live call: ключи не предоставлены; adapter проверен mock HTTP responses. Платные вызовы не делались.
- Независимый verifier, TTS, YouTube OAuth/upload, remote Supabase/Vercel deploy: не реализованы/не подключены на Sprint 0.
- Отдельная мобильная browser QA не выполнялась; responsive CSS предусмотрен, но это не заменяет такую проверку.

Demo — архитектурный каркас и интерфейс на фикстуре. Его успешный запуск не является проверкой научной корректности, качественного ES narration или готовностью публичного MVP.

## Dobrov Academy — branding v0.1

21 октября 2026: добавлены логотип/знак SVG, favicon, PNG social card через Next ImageResponse, брендовая палитра, style board и Vercel web configuration. Typecheck, 21 тест и offline demo пройдены. Production build включает `/icon.svg` и `/opengraph-image`. Главная страница просмотрена в браузере: новый logo/название/цвета отображаются, доступное имя ссылки ведёт на Dobrov Academy. Brand board отрендерен в PNG и визуально проверен. Домены и Vercel-проект в этой задаче не создавались и не подключались; live deployment не проверялся.
