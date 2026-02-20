# @nan0web/db-browser — Roadmap

## Done ✅

- ~~BrowserDriver (fetch/XHR) як I/O бекенд~~ — `fetchRemote()` стабільний
- ~~`extract()` override~~ — DBBrowser-specific subset creation
- ~~HEAD-based `statDocument()`~~ — завжди HTTP HEAD, без кешу
- ~~HTTP 403 retry~~ — v1.0.2: `fetchRemote()` ретраїть на 403 (Apache directory listing), не лише 404
- ~~knip + audit~~ — v1.0.2: `knip --production`, `pnpm audit --prod || true`, конвеєр `test:all`
- ~~duplicate export fix~~ — v1.0.2: `resolveSync.js` — прибрано дублікат default export

## Next: UDA 2.0 Integration (from `@nan0web/db` v1.2.2)

Base DB додав: fallback chain, model hydration, mount routing, watch/change events, fetchStream.
DBBrowser **override'ить** `fetch()`, `saveDocument()`, `dropDocument()` без `super` — тому ці фічі обходяться.

### Task 1: fetch() → super.fetch() delegation

**Файл:** `src/DBBrowser.js`, метод `fetch()`

**Проблема:** Поточна реалізація повністю обходить base `fetch()`, тому:

- ❌ fallback chain не працює
- ❌ model hydration не працює
- ❌ mount routing не працює

**Рішення:** Перейменувати поточний `fetch()` у `_fetchPrimary()` override, і нехай base `fetch()` делегує.

**⚠️ Breaking change:** Повернення `undefined` замість `{ error: 'Not found' }` — перевірити consumers.

### Task 2: emit('change') в saveDocument()

**Файл:** `src/DBBrowser.js`, метод `saveDocument()`

```js
this.emit('change', { uri, type: 'save', data: document })
```

### Task 3: emit('change') в dropDocument()

**Файл:** `src/DBBrowser.js`, метод `dropDocument()`

```js
this.emit('change', { uri, type: 'drop' })
```

### Task 4: Тести UDA 2.0

- fallback chain
- model hydration
- change events від save/drop

### Pre-existing Test Failures

4 тести без `# TODO` що падають (передіснуючі, не регресія від v1.0.2):

| Тест                                            | Файл                    | Проблема               |
| ----------------------------------------------- | ----------------------- | ---------------------- |
| `should POST document and return JSON response` | `DB.test.js:423`        | `saveDocument` mock    |
| `should not go into infinite loop`              | `DBBrowser.test.js:164` | fetchRemote loop logic |
| `should load document without index`            | `DBBrowser.test.js:433` | statDocument mock      |
| `should handle missing Last-Modified header`    | `DBBrowser.test.js:451` | statDocument mock      |

6 тестів `# TODO` в `DB.test.js` — resolveSync integration.

### Risk Assessment

| Зміна                         | Ризик       | Міра                                                             |
| ----------------------------- | ----------- | ---------------------------------------------------------------- |
| `fetch()` → `_fetchPrimary()` | 🔴 Breaking | Перевірити consumers на `{ error: 'Not found' }`                 |
| `emit('change')` в save/drop  | 🟢 Safe     | Additive — нові events                                           |
| mount routing                 | 🟡 Medium   | `fetchRemote()` використовує `this.host` — verify URL resolution |

### Verification

```bash
pnpm test:all
pnpm release:spec
```
