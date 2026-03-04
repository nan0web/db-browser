# @nan0web/db-browser — Roadmap

## Done ✅

- ~~BrowserDriver (fetch/XHR) як I/O бекенд~~ — `fetchRemote()` стабільний
- ~~`extract()` override~~ — DBBrowser-specific subset creation
- ~~HEAD-based `statDocument()`~~ — завжди HTTP HEAD, без кешу
- ~~HTTP 403 retry~~ — v1.0.2: `fetchRemote()` ретраїть на 403 (Apache directory listing), не лише 404
- ~~knip + audit~~ — v1.0.2: `knip --production`, `pnpm audit --prod || true`, конвеєр `test:all`
- ~~duplicate export fix~~ — v1.0.2: `resolveSync.js` — прибрано дублікат default export
- ~~UDA 2.0 Integration~~ — v1.1.0: fallback chain, model hydration, mount routing, change events
- ~~`_fetchPrimary()` delegation~~ — v1.1.0: base `DB.fetch()` тепер успадковується
- ~~`emit('change')`~~ — v1.1.0: `saveDocument()` та `dropDocument()` тепер емітять change events
- ~~Proactive `.json` extension~~ — v1.1.0: `fetchRemote()` уникає зайвих 404/403 у консолі
- ~~`loadDocument()` text support~~ — v1.1.0: підтримка DirectoryIndex/txtl, а не лише JSON
- ~~Playground UDA 2.0~~ — v1.1.0: оновлено `play/` — демонстрація fallback chain та change events
- ~~Version bump~~ — v1.1.0 (breaking: `_fetchPrimary` повертає `undefined` замість `{ error }`)

## Next

- [ ] Опублікувати `@nan0web/http-node` v1.0.2 (з `mockFetch` base support)
- [ ] Вирішити 6 `TODO` тестів resolve у `DB.test.js`
- [ ] Додати тести для model hydration та mount routing
- [ ] Перевірити consumers на зміну з `{ error: 'Not found' }` → `undefined`
- [ ] Додати UDA 2.0 приклади до README.md.js (fallback chain, change events)

#.
