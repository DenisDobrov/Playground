# Ближайшие срезы — обновление 22 октября 2026

Пользователь уточнил приоритет после merge PR5: инструменты производства контента, видео, голоса и анализа новостей. Paid deep research и сравнение verifier сейчас не запускаем. Один самостоятельный срез — один PR; без автоматического merge.

PR2–5 слиты. Есть Auth/manual decisions, реальные локальные arXiv/NASA candidates, приватный каталог, EN public preview и экспорт selection feedback. Cloud установлен до 004 с membership; 005–008 пока локальные. Public ES/EN по-прежнему synthetic, Vercel live Auth activation отдельно. Исходный трёхспринтовый ориентир не является обещанием календарного релиза.

## Срез 1 — бюджет производственных инструментов (PR6)

**Реализовано:** атомарные reserve/start/settle/release, uncertain receipts, idempotency, лимиты UTC месяца/категории/сюжета/видео. Четыре категории news_analysis, content, voice, video. Read-only редакционный экран бюджета, локальный metadata brief и планировщик token/character/runtime ceilings. Тарифы не выдумываются; без карты цена null. Все выполненные команды — без платных вызовов. Подробности и ограничения — PRODUCTION-BUDGET.md.

**DoD:** два worker не занимают один остаток и не отправляют один request дважды; timeout после dispatch не освобождает деньги; реальный перерасход учтён и блокирует следующий dispatch. RLS/roles, actual billing retry и HTTP экран проверены. Это ledger и tooling foundation, не готовые AI writer/TTS/Remotion.

## Срез 2 — анализ новостей и контентный пакет

**Результат:** от настоящего кандидата до объяснимого редакционного brief и draft package.

1. Bounded news-analysis adapter: novelty/context/source limitations, предложенный select/reject/hold с reason. AI suggestion хранится отдельно от human label; source text и мотивы — untrusted input.
2. Writer/outline для ES и EN из разрешённых источников и проверяемых утверждений; отдельно ES video outline. Черновики явно не опубликованы, unsupported facts не добавляются.
3. Подключать metered operation через ledger; tool/model/prompt/price/input versions, units, receipt и artifact checksum. Реальные цены/ключи вводятся при подключении выбранного adapter; никаких фоновых платных запусков из demo.
4. Независимая человеческая разметка 20–30 candidates, затем frozen selection snapshot для сравнения отбора. Claim-verification gold set с quote/locator — отдельная работа; title metadata для него недостаточно.

**DoD:** редактор видит source lineage, rationale и ограничения, может изменить решение с историей. Draft revisions неизменяемы. Ledger показывает фактическую стоимость каждого инструмента. Наличие текста не означает scientific verification или approval.

## Срез 3 — голос и технический видеопилот

**Результат:** воспроизводимый audio/video pipeline на явно тестовом тексте, затем применение к одобренной статье.

1. Выбрать один TTS по коротким ES samples и актуальным условиям/цене; выбор голоса Денисом. Pronunciation lexicon, metered character/audio units и реальные timings/checksums; повтор не оплачивается заново без основания.
2. Remotion scene templates (diagram/chart/real asset), FFmpeg assembly/mux/subtitles. Проверить условия лицензии при подключении renderer; собственные SVG/FFmpeg остаются бюджетным fallback.
3. Asset provenance/rights/attribution; неизвестные права блокируют release. Scene input hashes, проверенный cache, heartbeat и устойчивый artifact storage.
4. QA звука, терминов, captions, пустых кадров и маркировки. Измерить cost/video, cost/minute, render time и human review time. Synthetic rehearsal не называть научным выпуском.

**DoD:** технический ролик с narration, читаемыми субтитрами и воспроизводимым монтажом; исправление сцены сохраняет остальные проверенные outputs. Цель реального пилота — один ES ролик 6–8 минут в неделю; масштабирование позже.

## Перед выпуском реальной новости

Полноценные evidence-backed dossier/claims, независимая научная и языковая проверки, отдельные approvals ES/EN и видео остаются обязательными. Paid verifier comparison Claude/OpenAI выполняется позже на содержательном gold set, с проверенными model IDs/тарифами и отдельным лимитом. Для public web release нужны серверный publisher и corrections; для YouTube — OAuth/resumable private upload, reconciliation и отдельное подтверждение public release. Видео не блокирует статью.

Сначала локальные инструменты и preview; worker host/домен/Vercel live activation — отдельные настройки. Google используется только для Gemini/YouTube. При нехватке бюджета снижаем объём, сохраняя evidence, права и review.


## SCI-002 — primary metadata / reviewed identities

Бесплатные arXiv/Crossref lookup через существующий bounded transport, provider lease и worker queue; immutable snapshots, ручное подтверждение DOI↔arXiv, append-only pending resolution и reviewed event reconciliation реализованы локально в migration 011. Новые feed DOI suggestions больше не создают alias автоматически; старые aliases сохранены. Метаданные не верифицируют научные claims. Команды, ограничения и минимальный следующий content pilot — [SCI-002.md](SCI-002.md). Cloud/production не менялись; paid LLM не вызывались.


SCI-003: первичный PDF/текст → located evidence → versioned Research Dossier → независимое human review и отдельный whole-dossier approval → Editorial Brief. Контракт, реальный локальный пилот и оставшаяся human acceptance — [SCI-003.md](SCI-003.md). Cloud/production не менялись; статьи/видео и paid calls не реализуются этим срезом.

## VIDEO-001 — 31 октября 2026

Реализован технический срез scene/asset/voice/consent contracts и bounded 2D FFmpeg fallback с checksum cache. Видео допускает точные одобренные dossier + brief без web-статьи; прежний published article path сохранён. Это не полный видеопилот, paid adapters/Remotion/publisher отсутствуют. Границы, проверки и следующие срезы — [VIDEO-HLD.md](VIDEO-HLD.md).

## SCI-004 — content drafts, 31 октября 2026

Локальная реализация exact approved dossier/brief → отдельные ES/EN article drafts и ES scene-script: SCI-004.md. Immutable receipts/revisions, metered Gemini adapter, reserve/start/settle, claim/caveat mapping и human review добавлены; migration 013 только локальная. Реальный pilot пока не прошёл acceptance: отсутствуют четыре human claim decisions/whole-dossier approval/final brief и Gemini credentials/model/prices. Не считать synthetic tests реальным контентом. Следующий шаг — закрыть эти prerequisites и выполнить реальный тройной прогон с отчётом usage/cost; никаких TTS/render/upload или cloud install в этом срезе.
