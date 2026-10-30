# SCI-001 — Final technical review

Проверяются два конкретных риска PR7. HLD и MVP scope не изменяются. Исправления включены в тот же PR; автоматический merge запрещён. Cloud migrations и live configuration не выполнялись.

## Findings

| Finding | Severity | Основание |
|---|---|---|
| Undated event identity collision | P2 / medium, data integrity | В 009 work + kind + пустая date/revision давали одинаковый event_key для разных сообщений. Partial/unrecognized dates также не являются надёжной cross-report identity. |
| Direct RPC extraction forgery | P2 / medium, provenance integrity | Server Action перепарсивает Markdown, но authenticated editor мог обойти его и напрямую вызвать import_external_review с произвольным extraction JSON. Hash оригинала подтверждал текст, а не связь extraction с ним. Это не обход editor role и не автоматическое verified/publication, но immutable attribution могла быть ложной. |

## Минимальные исправления

Применённая локально 009 сохранена без изменений. Follow-up `202610300010_review_integrity.sql` заменяет команду импорта и добавляет только приватный attestation key.

**Events:** для события без полной ISO date и без revision ключ дополнительно включает immutable review_item UUID. Разные исходные разделы/обзоры сохраняют разные uncertain observations. Повтор той же selection использует тот же item и не создаёт дублей. Полные даты и версии сохраняют прежнюю cross-report дедупликацию. UUID существующих events и lineage сохранены при локальном backfill event_key. Сведения, уже потерянные из-за прежнего collapse, автоматически не восстанавливаются: исходные items/Markdown остаются основанием для будущего reviewed reconciliation.

**Provenance:** `prepareReviewImport` принимает Markdown и выбор editor, заново строит extraction через существующий parser и подписывает exact payload. Server-only HMAC привязан к actor UUID, parser version, source type, raw Markdown SHA-256 и exact JSON text SHA-256. RPC проверяет обычный authenticated editor role и подпись **до** записи или idempotent early return. Старый unsigned overload удалён. На повторе уже сохранённая extraction также должна совпасть: несовместимый legacy record не получает молчаливое подтверждение.

`p_items` теперь передаётся как exact JSON text; новый аргумент `p_attestation` — hex HMAC. Это intentional closing of the direct-JSON bypass, не новая система authorization. Ни подписывающего RPC, ни authenticated SELECT на signing key нет. Browser передаёт только Markdown/selection; ключ не передаётся клиенту, service-role key в web не добавляется. SQL tests используют собственный rollback-only privileged fixture signer, которого нет в приложении.

## Настройка локального окружения

```powershell
npx supabase migration up --local
npm run web:local:review-key
npm run web:local
```

Команда ключа ограничена local DB 56322 и `.env.local-web` с API 56321; сохраняет прежние settings/allowlist и не выводит secret. Новая `web:local:env` автоматически подхватывает ключ после 010. До 010 остальные локальные страницы работают как раньше. После замены env перезапустить Next.

Для будущей live установки нужен отдельный `EDITORIAL_REVIEW_SIGNING_KEY`: 64 hex chars из приватной `academy.review_import_signing_key`, совпадающий с ключом этой БД. Provisioning/rotation — отдельное административное действие после явного approval. Не использовать Auth signing secret или service-role key. Никаких live env/migration изменений в этой проверке не выполнялось. Отсутствующий ключ закрывает confirmation, но не выдаёт fake success.

## Regression validation

- Unit: подпись и её binding, повторный server parsing, отказ без ключа, invalid selection и forged identity; клиентский extraction не является входом signer.
- SQL: прямой editor call без MAC, изменённые Markdown/payload/actor, private key grants, отсутствующий unsigned overload, inconsistent legacy extraction — отказ; разные undated observations — сохранены; replay, complete-date и revision dedupe — сохранены.
- Реальный weekly fixture: signed import/reimport, original/hash, old arXiv + journal event и отсутствие verified claims; rollback.
- HTTP: настоящие local Auth/Server Actions и подписанный RPC; подставленный browser extraction игнорируется. Paste/upload, preview/no-write, selected confirm/reimport, scope, source archive, roles, CSRF, catalog и budget проверены.
- Существующие queue/budget integration, typecheck, production build, unit/SQL suite и offline demo повторены. Итоговые результаты — VALIDATION.md и CI PR7.

## Remaining limitations / merge gate

Attestation подтверждает результат доверенного parser, не подлинность внешнего отчёта и не научную истину. Web signer и DB administrators остаются доверенной границей; компрометация их секретов вне этой защиты. Недатированные события могут оказаться сообщениями об одном и том же событии — до primary metadata confirmation они намеренно сохраняются отдельно. Семантика двух событий одного типа в один день всё ещё может потребовать provider ID/дополнительного discriminator в SCI-002.

Parser formats, manual identity choice и pending-resolution limitations SCI-001 сохранены. SCI-002 только спланирован в SCI-002-PLAN.md. Future manuscript/submission capability внесена отдельно в BACKLOG.md.

Merge recommendation: merge после зелёного CI на последнем head и review diff. Не включать live deployment, пока отдельно не согласованы migrations до 010 и provisioning dedicated key. Автоматический merge не выполняется.
