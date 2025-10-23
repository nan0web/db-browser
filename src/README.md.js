import { describe, it, before, beforeEach } from "node:test"
import assert from "node:assert/strict"
import FS from "@nan0web/db-fs"
import { NoConsole } from "@nan0web/log"
import {
	DatasetParser, // use for .datasets with it("How to ...?"
	DocsParser, // use for .md with it("How to ...?"
	runSpawn, // use for running commands
} from "@nan0web/test"
import DBBrowserBase from "./DBBrowser.js"
import { mockFetch } from "@nan0web/http-node"

class DBBrowser extends DBBrowserBase {
	constructor(options = {}) {
		const host = options.host || "https://api.example.com"
		const root = options.root || "/data/"

		const mocks = [
			// Index load
			[
				"GET " + host + root + "index.json",
				{ version: "1.0.0", description: "Demo Index" }
			],
			// Fetch document
			[
				"GET " + host + root + "users.json",
				[200, [
					{ id: 1, name: "Alice", email: "alice@example.com" },
					{ id: 2, name: "Bob", email: "bob@example.com" }
				]]
			],
			// Save document
			[
				"POST " + host + root + "new-file.json",
				[201, true]
			],
			// Write document
			[
				"PUT " + host + root + "users.json",
				[201, { written: true }]
			],
			// Drop document
			[
				"DELETE " + host + root + "new-file.json",
				{ ok: true, json: async () => ({}) }
			],
			// Read directory
			[
				"GET " + host + root + "index.txt",
				"users.json 1 1\nposts/first.json 1 1"
			],
			// Search documents
			[
				"GET " + host + root + "index.txt",
				"users.json 1 1\nposts.json 2 2"
			],
			// Extract subset
			[
				"GET " + host + root + "posts/index.json",
				[200, [
					{ name: "config.yaml", type: "F", mtimeMs: Date.now(), size: 50 },
					{ name: "users.json", type: "F", mtimeMs: Date.now(), size: 150 }
				]]
			]
		]

		super({
			host,
			root,
			fetchFn: mockFetch(mocks),
			...options
		})
	}
	extract(uri) {
		return DBBrowser.from(super.extract(uri))
	}
	static from(input) {
		if (input instanceof DBBrowser) return input
		return new DBBrowser(input)
	}
}

const fs = new FS()
let pkg

// Load package.json once before tests
before(async () => {
	const doc = await fs.loadDocument("package.json", {})
	pkg = doc || {}
})

let console = new NoConsole()

beforeEach((info) => {
	console = new NoConsole()
})

/**
 * Core test suite that also serves as the source for README generation.
 *
 * The block comments inside each `it` block are extracted to build
 * the final `README.md`. Keeping the comments here ensures the
 * documentation stays close to the code.
 */
function testRender() {
	/**
	 * @docs
	 * # @nan0web/db-browser
	 *
	 * Browser Database client as extension of @nan0web/db
	 *
	 * <!-- %PACKAGE_STATUS% -->
	 *
	 * ## Description
	 *
	 * The `@nan0web/db-browser` package provides a database interface for browser environments,
	 * extending the base `@nan0web/db` functionality with HTTP-based document operations.
	 * Core class:
	 *
	 * - `DBBrowser` — extends DB with browser-specific features like remote fetching and saving
	 *   via standard HTTP methods (GET, POST, PUT, DELETE).
	 *
	 * This package is ideal for building browser-based applications that require remote data
	 * fetching with support for inheritance, references, and directory indexing.
	 *
	 * ## Installation
	 */
	it("How to install with npm?", () => {
		/**
		 * ```bash
		 * npm install @nan0web/db-browser
		 * ```
		 */
		assert.equal(pkg.name, "@nan0web/db-browser")
	})
	/**
	 * @docs
	 */
	it("How to install with pnpm?", () => {
		/**
		 * ```bash
		 * pnpm add @nan0web/db-browser
		 * ```
		 */
		assert.equal(pkg.name, "@nan0web/db-browser")
	})
	/**
	 * @docs
	 */
	it("How to install with yarn?", () => {
		/**
		 * ```bash
		 * yarn add @nan0web/db-browser
		 * ```
		 */
		assert.equal(pkg.name, "@nan0web/db-browser")
	})

	/**
	 * @docs
	 * ### Fetching Documents
	 *
	 * DBBrowser supports fetching documents from remote servers with full URI resolution.
	 */
	it("How to fetch a document?", async () => {
		//import DBBrowser from "@nan0web/db-browser"
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
		assert.deepStrictEqual(console.output()[0][1], [
			{ "email": "alice@example.com", "id": 1, "name": "Alice" },
			{ "email": "bob@example.com", "id": 2, "name": "Bob" },
		])
	})

	/**
	 * @docs
	 * ### Saving Documents
	 *
	 * Use POST requests to save new documents.
	 * The server side must provide such API.
	 */
	it("How to save a new document?", async () => {
		//import DBBrowser from "@nan0web/db-browser"
		const db = new DBBrowser({
			host: "https://api.example.com",
			root: "/data/"
		})

		const result = await db.saveDocument("new-file.json", { test: "value" })
		console.info("Save result:", result) // ← Save result: true
		assert.equal(console.output()[0][1], "Save result:")
		assert.equal(console.output()[0][2], true)
	})

	/**
	 * @docs
	 * ### Writing Documents
	 *
	 * Use PUT requests to update or overwrite existing documents.
	 */
	it("How to write (update) a document?", async () => {
		//import DBBrowser from "@nan0web/db-browser"
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
		assert.deepStrictEqual(console.output()[0][1], "Write result:")
		assert.deepStrictEqual(console.output()[0][2], { written: true })
	})

	/**
	 * @docs
	 * ### Dropping Documents
	 *
	 * Use DELETE requests to remove documents.
	 */
	it("How to drop a document?", async () => {
		//import DBBrowser from "@nan0web/db-browser"
		const db = new DBBrowser({
			host: "https://api.example.com",
			root: "/data/"
		})

		const result = await db.dropDocument("new-file.json")
		console.info("Drop result:", result) // ← Drop result: true
		assert.equal(console.output()[0][1], "Drop result:")
		assert.equal(console.output()[0][2], true)
	})

	/**
	 * @docs
	 * ### Directory Reading
	 *
	 * DBBrowser supports reading directories and resolving relative paths.
	 */
	it("How to read directory contents?", async () => {
		//import DBBrowser from "@nan0web/db-browser"
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
		assert.deepStrictEqual(console.output()[0][1], "Directory entries:")
		assert.deepStrictEqual(console.output()[0][2], ["users.json", "posts/first.json"])
	})

	/**
	 * @docs
	 * ### Search Documents
	 *
	 * Supports glob-style searching within remote structures.
	 */
	it("How to search for documents?", async () => {
		//import DBBrowser from "@nan0web/db-browser"

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
		assert.deepStrictEqual(console.output()[0][1], "Found JSON files:")
		assert.deepStrictEqual(console.output()[0][2], ["/data/users.json", "/data/posts/first.json"])
	})

	/**
	 * @docs
	 * ### Extract Subset
	 *
	 * Create a new DBBrowser instance rooted at a specific subdirectory.
	 */
	it("How to extract a subset of the database?", async () => {
		//import DBBrowser from "@nan0web/db-browser"
		const db = new DBBrowser({
			host: "https://api.example.com",
			root: "/data/"
		})

		const subDB = db.extract("posts/")
		console.info("Subset root:", subDB.root) // ← Subset root: data/posts/
		console.info("Subset instanceof DBBrowser:", subDB instanceof DBBrowser)
		// Subset instanceof DBBrowser: true

		assert.equal(console.output()[0][1], "Subset root:")
		assert.equal(console.output()[0][2], "data/posts/")
		assert.equal(console.output()[1][1], "Subset instanceof DBBrowser:")
		assert.equal(console.output()[1][2], true)
	})

	/**
	 * @docs
	 * ## API
	 *
	 * ### DBBrowser
	 *
	 * Extends `@nan0web/db`.
	 *
	 * * **Static Properties**
	 *   * `FetchFn` – Static fetch function used globally unless overridden.
	 *
	 * * **Instance Properties**
	 *   * `host` – Base URL host.
	 *   * `timeout` – Default timeout for requests (ms).
	 *   * `fetchFn` – Per-instance fetch handler.
	 *
	 * * **Methods**
	 *   * `ensureAccess(uri, level)` – Validates access mode for a URI.
	 *   * `fetchRemote(uri, requestInit)` – Performs remote fetch with timeout handling.
	 *   * `load()` – Loads the root index.
	 *   * `statDocument(uri)` – Fetches metadata via HEAD request.
	 *   * `loadDocument(uri, defaultValue)` – Fetches and parses a document.
	 *   * `saveDocument(uri, document)` – Saves a new file using POST.
	 *   * `writeDocument(uri, document)` – Updates/overwrites file using PUT.
	 *   * `dropDocument(uri)` – Deletes a file using DELETE.
	 *   * `extract(uri)` – Creates a new DB subset rooted at the URI.
	 *   * `readDir(uri)` – Reads directory contents with index loading support.
	 *   * `static from(input)` – Instantiates or returns existing DBBrowser instance.
	 */
	it("All exported classes should pass basic test to ensure API examples work", () => {
		assert.ok(DBBrowser)
	})

	/**
	 * @docs
	 * ## Java•Script
	 */
	it("Uses `d.ts` files for autocompletion", () => {
		assert.equal(pkg.types, "types/index.d.ts")
	})

	/**
	 * @docs
	 * ## CLI Playground
	 */
	it("How to run DBBrowser demo?", async () => {
		/**
		 * ```bash
		 * git clone https://github.com/nan0web/db-browser.git
		 * cd db-browser
		 * npm install
		 * npm run play
		 * ```
		 */
		assert.ok(String(pkg.scripts?.play).includes("node play"))
		const response = await runSpawn("node", ["play/main.js"], { timeout: 999 })
		assert.ok(response.code === 0)
		assert.ok(response.text.includes("DBBrowser Demo"))
	})

	/**
	 * @docs
	 * ## Contributing
	 */
	it("How to contribute? - [check here](./CONTRIBUTING.md)", async () => {
		assert.equal(pkg.scripts?.precommit, "npm test")
		assert.equal(pkg.scripts?.prepush, "npm test")
		assert.equal(pkg.scripts?.prepare, "husky")
	})

	/**
	 * @docs
	 * ## License
	 */
	it("How to check license ISC? - [check here](./LICENSE)", async () => {
		assert.ok(fs)
		const text = await fs.loadDocument("LICENSE")
		assert.ok(String(text).includes("ISC"))
	})
}

describe("README.md testing", testRender)

describe("Rendering README.md", async () => {
	let text = ""
	const format = new Intl.NumberFormat("en-US").format
	const parser = new DocsParser()
	text = String(parser.decode(testRender))
	await fs.saveDocument("README.md", text)
	const dataset = DatasetParser.parse(text, pkg.name)
	await fs.saveDocument(".datasets/README.dataset.jsonl", dataset)

	it(`document is rendered in README.md [${format(Buffer.byteLength(text))}b]`, async () => {
		const text = await fs.loadDocument("README.md")
		assert.ok(text.includes("## License"))
	})
})
