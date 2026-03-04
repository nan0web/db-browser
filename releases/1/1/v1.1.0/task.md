# Release v1.1.0 — UDA 2.0 Integration

## Scope

Інтеграція Universal Data Architecture 2.0 з базового `@nan0web/db` v1.3.1 у браузерний клієнт.

## Що зроблено

### Breaking Changes

- `fetch()` → `_fetchPrimary()` — повертає `undefined` замість `{ error: 'Not found' }` при невдачі.

### Нові можливості

- **Fallback Chain**: `attach(db)` підключає резервну БД. При невдалому fetch автоматично запитуються attached databases.
- **Change Events**: `saveDocument()` та `dropDocument()` емітять `'change'` події з `{ uri, type, data }`.
- **Proactive `.json` extension**: `fetchRemote()` спочатку пробує URI з `.json`, щоб уникнути зайвих 404/403 у консолі.
- **Text-safe `loadDocument()`**: Тепер парсить як JSON, так і plain text (для DirectoryIndex/txtl).
- **BrowserStore**: IndexedDB-based offline storage (extracted to separate module).

### Документація

- Оновлено README.md з прикладами Fallback Chain та Change Events.
- Повний переклад на українську (`docs/uk/README.md`).
- Cross-language navigation links (🇬🇧/🇺🇦).

### Тести

- 6 нових UDA 2.0 тестів (fallback chain, events, \_fetchPrimary).
- 4 pre-existing test failures виправлено (mockFetch URL compatibility).
- 2 нових doc-тести (fallback chain, change events).
- Загалом: 126 unit + 18 doc = 144 тести, 0 failures.

## Acceptance Criteria

- [x] `db.attach(fallbackDb)` + `db.fetch()` знаходить документ у fallback
- [x] `saveDocument()` емітить `change` event з type `'save'`
- [x] `dropDocument()` емітить `change` event з type `'drop'`
- [x] `_fetchPrimary()` повертає `undefined` при 404
- [x] `fetchRemote()` proactively пробує `.json` extension
- [x] `loadDocument()` парсить text (не лише JSON)
- [x] README.md містить приклади UDA 2.0
- [x] docs/uk/README.md оновлено
- [x] test:all зеленіє
