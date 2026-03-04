# @nan0web/db-browser

Клієнт бази даних для браузера як розширення @nan0web/db

> 🇬🇧 [English](../../README.md) | 🇺🇦 [Українська](./README.md)

<!-- %PACKAGE_STATUS% -->

## Опис

Пакет `@nan0web/db-browser` надає інтерфейс до бази даних у середовищі браузера,
розширюючи базову функціональність `@nan0web/db` HTTP‑операціями над документами.
Основний клас:

- `DBBrowser` — успадковує DB і додає специфічні для браузера можливості,
  такі як віддалене отримання та збереження через стандартні HTTP‑методи
  (GET, POST, PUT, DELETE).

**v1.1.0** — UDA 2.0 Інтеграція: ланцюг резерву, події зміни, проактивне розширення `.json`.

Цей пакет ідеально підходить для розробки веб‑додатків, які потребують
віддаленого доступу до даних з підтримкою успадкування, посилань та індексування каталогів.

## Встановлення

Як встановити за допомогою npm?

```bash
npm install @nan0web/db-browser
```

Як встановити за допомогою pnpm?

```bash
pnpm add @nan0web/db-browser
```

Як встановити за допомогою yarn?

```bash
yarn add @nan0web/db-browser
```

### Отримання документів

DBBrowser підтримує отримання документів з віддалених серверів із повним
розв'язанням URI.

Як отримати документ?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const users = await db.fetch('users.json')
console.info(users)
// [
//   {"email":"alice@example.com","id":1,"name":"Alice"},
//   {"email":"bob@example.com","id":2,"name":"Bob"},
// ]
```

### Збереження документів

Для створення нових документів використовуйте POST‑запити.
Серверна частина повинна надати відповідний API.

Як зберегти новий документ?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const result = await db.saveDocument('new-file.json', { test: 'value' })
console.info('Save result:', result) // ← Save result: true
```

### Оновлення документів

Для оновлення або перезапису існуючих документів використовуйте PUT‑запити.

Як оновити (перезаписати) документ?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const data = [
  { id: 1, name: 'Alice Cooper', email: 'alice@example.com' },
  { id: 2, name: 'Bob Marley', email: 'bob@example.com' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com' },
]

const result = await db.writeDocument('users.json', data)
console.info('Write result:', result) // ← Write result: { written: true }
```

### Видалення документів

Для видалення документів використовуйте DELETE‑запити.

Як видалити документ?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const result = await db.dropDocument('new-file.json')
console.info('Drop result:', result) // ← Drop result: true
```

### Читання каталогу

DBBrowser підтримує читання вмісту каталогів та розв'язання відносних шляхів.

Як отримати вміст каталогу?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const entries = []
for await (const entry of db.readDir('.')) {
  entries.push(entry.name)
}
console.info('Directory entries:', entries)
// Directory entries: ["users.json", "posts/first.json"]
```

### Пошук документів

Підтримується пошук у стилі glob по віддаленій структурі.

Як знайти документи?

```js
import DBBrowser from '@nan0web/db-browser'

const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const entries = []
for await (const uri of db.find((uri) => uri.endsWith('.json'))) {
  entries.push(uri)
}
console.info('Found JSON files:', entries)
// Found JSON files: ["/data/users.json", "/data/posts/first.json"]
```

### Виділення підмножини

Створює новий екземпляр DBBrowser, коренем якого є певний підкаталог.

Як виділити підмножину бази даних?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const subDB = db.extract('posts/')
console.info('Subset root:', subDB.root) // ← Subset root: data/posts/
console.info('Subset instanceof DBBrowser:', subDB instanceof DBBrowser)
// Subset instanceof DBBrowser: true
```

### Ланцюг резерву (UDA 2.0)

Підʼєднайте вторинну базу даних як резервне джерело.
Якщо документ не знайдено в основній БД, автоматично запитується резервна.

Як використовувати ланцюг резерву?

```js
import DBBrowser from '@nan0web/db-browser'
const primary = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})
const fallback = new DBBrowser({
  host: 'https://cdn.example.com',
  root: '/data/',
})

primary.attach(fallback)
const users = await primary.fetch('users.json')
console.info('Отримано через ланцюг:', users)
// Отримано через ланцюг: [{...}, {...}]
```

### Події зміни (UDA 2.0)

Підписуйтесь на зміни документів при збереженні та видаленні.

Як слухати події зміни?

```js
import DBBrowser from '@nan0web/db-browser'
const db = new DBBrowser({
  host: 'https://api.example.com',
  root: '/data/',
})

const events = []
db.on('change', (event) => events.push(event))

await db.saveDocument('new-file.json', { test: 'value' })
await db.dropDocument('new-file.json')

console.info('Подій:', events.length) // ← Подій: 2
// events[0].type === 'save'
// events[1].type === 'drop'
```

## API

### DBBrowser

Розширює `@nan0web/db`.

- **Статичні властивості**
  - `FetchFn` – Статична функція fetch, що використовується глобально,
    якщо не переопреділена в інстанції.

- **Властивості інстанції**
  - `host` – Базовий URL хосту.
  - `timeout` – Час очікування запиту за замовчуванням (мс).
  - `fetchFn` – Обробник fetch для конкретного інстансу.

- **Методи**
  - `ensureAccess(uri, level)` – Перевіряє режим доступу для URI.
  - `fetchRemote(uri, requestInit)` – Виконує віддалений fetch з обробкою тайм‑ауту.
  - `_fetchPrimary(uri)` – Основна логіка fetch (v1.1.0: перейменовано з `fetch()`).
  - `load()` – Завантажує кореневий індекс.
  - `statDocument(uri)` – Отримує метадані через HEAD‑запит.
  - `loadDocument(uri, defaultValue)` – Завантажує та парсить документ (JSON + текст).
  - `saveDocument(uri, document)` – Створює новий файл через POST. Емітить подію `change`.
  - `writeDocument(uri, document)` – Оновлює/перезаписує файл через PUT.
  - `dropDocument(uri)` – Видаляє файл через DELETE. Емітить подію `change`.
  - `extract(uri)` – Створює нову під‑БД, коренем якої є зазначений URI.
  - `readDir(uri)` – Читає вміст каталогу з підтримкою індексу.
  - `attach(db)` – Підʼєднує резервну базу даних (UDA 2.0).
  - `on('change', fn)` – Підписка на події зміни документів (UDA 2.0).
  - `static from(input)` – Створює інстанцію або повертає вже існуючу.

## Java•Script

Використовує `.d.ts` файли для автодоповнення.

## CLI Playground

Як запустити демо DBBrowser?

```bash
git clone https://github.com/nan0web/db-browser.git
cd db-browser
npm install
npm run play
```

## Внесок

Як допомогти? – [дивіться тут](../../CONTRIBUTING.md)

## Ліцензія

Як перевірити ліцензію ISC? – [дивіться тут](../../LICENSE)
