# @nan0web/db-browser

Browser Database client as extension of @nan0web/db

|Package name|[Status](https://github.com/nan0web/monorepo/blob/main/system.md#написання-сценаріїв)|Documentation|Test coverage|Features|Npm version|
|---|---|---|---|---|---|
 |[@nan0web/db-browser](https://github.com/nan0web/db-browser/) |🟢 `97.5%` |🧪 [English 🏴󠁧󠁢󠁥󠁮󠁧󠁿](https://github.com/nan0web/db-browser/blob/main/README.md)<br />[Українською 🇺🇦](https://github.com/nan0web/db-browser/blob/main/docs/uk/README.md) |🟡 `85.7%` |✅ d.ts 📜 system.md 🕹️ playground |1.0.0 |

## Description

The `@nan0web/db-browser` package provides a database interface for browser environments,
extending the base `@nan0web/db` functionality with HTTP-based document operations.
Core class:

- `DBBrowser` — extends DB with browser-specific features like remote fetching and saving
  via standard HTTP methods (GET, POST, PUT, DELETE).

This package is ideal for building browser-based applications that require remote data
fetching with support for inheritance, references, and directory indexing.

## Installation

How to install with npm?
```bash
npm install @nan0web/db-browser
```

How to install with pnpm?
```bash
pnpm add @nan0web/db-browser
```

How to install with yarn?
```bash
yarn add @nan0web/db-browser
```

### Fetching Documents

DBBrowser supports fetching documents from remote servers with full URI resolution.

How to fetch a document?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const users = await db.fetch("users.json")
console.info(users)
// [
//   {"email":"alice@example.com","id":1,"name":"Alice"},
//   {"email":"bob@example.com","id":2,"name":"Bob"},
// ]
```
### Saving Documents

Use POST requests to save new documents.
The server side must provide such API.

How to save a new document?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const result = await db.saveDocument("new-file.json", { test: "value" })
console.info("Save result:", result) // ← Save result: true
```
### Writing Documents

Use PUT requests to update or overwrite existing documents.

How to write (update) a document?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const data = [
	{ id: 1, name: "Alice Cooper", email: "alice@example.com" },
	{ id: 2, name: "Bob Marley", email: "bob@example.com" },
	{ id: 3, name: "Charlie Brown", email: "charlie@example.com" }
]
const result = await db.writeDocument("users.json", data)
console.info("Write result:", result) // ← Write result: { written: true }
```
### Dropping Documents

Use DELETE requests to remove documents.

How to drop a document?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const result = await db.dropDocument("new-file.json")
console.info("Drop result:", result) // ← Drop result: true
```
### Directory Reading

DBBrowser supports reading directories and resolving relative paths.

How to read directory contents?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const entries = []
for await (const entry of db.readDir(".")) {
	entries.push(entry.name)
}
console.info("Directory entries:", entries)
// Directory entries: ["users.json", "posts/first.json"]
```
### Search Documents

Supports glob-style searching within remote structures.

How to search for documents?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const entries = []
for await (const uri of db.find(uri => uri.endsWith(".json"))) {
	entries.push(uri)
}
console.info("Found JSON files:", entries)
// Found JSON files: ["/data/users.json", "/data/posts/first.json"]
```
### Extract Subset

Create a new DBBrowser instance rooted at a specific subdirectory.

How to extract a subset of the database?
```js
import DBBrowser from "@nan0web/db-browser"
const db = new DBBrowser({
	host: "https://api.example.com",
	root: "/data/"
})
const subDB = db.extract("posts/")
console.info("Subset cwd:", subDB.cwd) // ← Subset root: data/posts/
console.info("Subset root:", subDB.root) // ← Subset root: data/posts/
console.info("Subset instanceof DBBrowser:", subDB instanceof DBBrowser)
// Subset instanceof DBBrowser: true
```
## API

### DBBrowser

Extends `@nan0web/db`.

* **Static Properties**
  * `FetchFn` – Static fetch function used globally unless overridden.

* **Instance Properties**
  * `host` – Base URL host.
  * `timeout` – Default timeout for requests (ms).
  * `fetchFn` – Per-instance fetch handler.

* **Methods**
  * `ensureAccess(uri, level)` – Validates access mode for a URI.
  * `fetchRemote(uri, requestInit)` – Performs remote fetch with timeout handling.
  * `load()` – Loads the root index.
  * `statDocument(uri)` – Fetches metadata via HEAD request.
  * `loadDocument(uri, defaultValue)` – Fetches and parses a document.
  * `saveDocument(uri, document)` – Saves a new file using POST.
  * `writeDocument(uri, document)` – Updates/overwrites file using PUT.
  * `dropDocument(uri)` – Deletes a file using DELETE.
  * `extract(uri)` – Creates a new DB subset rooted at the URI.
  * `readDir(uri)` – Reads directory contents with index loading support.
  * `static from(input)` – Instantiates or returns existing DBBrowser instance.

All exported classes should pass basic test to ensure API examples work

## Java•Script

Uses `d.ts` files for autocompletion

## CLI Playground

How to run DBBrowser demo?
```bash
git clone https://github.com/nan0web/db-browser.git
cd db-browser
npm install
npm run play
```

## Contributing

How to contribute? - [check here](./CONTRIBUTING.md)

## License

How to check license ISC? - [check here](./LICENSE)
