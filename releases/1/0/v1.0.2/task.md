# Release v1.0.2 — HTTP 403 Retry (Server-Agnostic fetchRemote)

## Scope

Patch release: `fetchRemote()` тепер ретраїть з `.json` розширенням
на HTTP 403, не лише на 404.

## Проблема

Apache повертає **403 Forbidden** коли URI збігається з назвою директорії
(наприклад, `/data/_` де існує `_/` каталог) і `Options -Indexes` встановлено.
Це ламало bank shell на `bank.yaro.page` (Apache), хоча dev-сервери працювали (404).

## Джерело

`REQUESTS.md#1` від `@industrialbank/bank` (Priority: Critical, 2026-02-20)

## Зміни

| Файл                    | Зміна                                               |
| ----------------------- | --------------------------------------------------- |
| `src/DBBrowser.js:156`  | `response.status === 403` додано до retry condition |
| `src/DBBrowser.test.js` | Unit тест для 403 retry                             |

## Acceptance Criteria (Definition of Done)

- [x] `fetchRemote` ретраїть на 403 з `.json` розширенням
- [x] `fetchRemote` зберігає backward compatibility (404 retry працює)
- [x] `fetchRemote` НЕ ретраїть на інші 4xx (401, 500)
- [x] Версія в `package.json` = `1.0.2`

## Architecture Audit

- [x] Прочитано system.md
- [x] Аналогів немає — це bugfix існуючої логіки
- [x] Джерела даних: не змінюються
- [x] UI-стандарт: не стосується (внутрішня логіка)
