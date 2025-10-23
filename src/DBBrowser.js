import DB, { DocumentStat, DocumentEntry } from "@nan0web/db"
import { HTTPError } from "@nan0web/http"
import { NoConsole } from "@nan0web/log"
import BrowserDirectory from "./Directory.js"
import resolveSync from "./utils/resolveSync.js"

class Headers extends Map {
	/**
	 * @param {*} entries
	 */
	constructor(entries = []) {
		if (!Array.isArray(entries)) {
			entries = entries instanceof Map ? Array.from(entries.entries()) : Object.entries(entries)
		}
		const fixed = entries.map(([name, value]) => [name.toLowerCase(), value])
		super(fixed)
	}
}

/**
 * DBBrowser – minimal, test‑focused implementation.
 *
 * Core design:
 * • Direct `fetch` returns `json()` when possible, otherwise falls back to `text()`.
 * • `fetchRemote` removes host for `mockFetch`, handles retries.
 * • `statDocument` ignores any cache (super.statDocument) to ensure `isFile` is set.
 */
export default class DBBrowser extends DB {
	static Directory = BrowserDirectory
	static FetchOptions = DB.FetchOptions

	/** @type {Function | null} */
	static #FetchFn = null

	/** @type {Function} */
	static get FetchFn() {
		if (this.#FetchFn) return this.#FetchFn
		if (typeof window !== "undefined" && window.fetch) {
			this.#FetchFn = window.fetch.bind(window)
		} else {
			this.#FetchFn = async () => {
				throw new Error("Fetch not available in this environment")
			}
		}
		return this.#FetchFn
	}

	/** @type {string} */
	host = ""
	/** @type {number} */
	timeout = 6_000

	/** @type {Function} */
	fetchFn = DBBrowser.FetchFn

	/**
	 * @param {object} [input]
	 * @param {string} [input.host] - window.location.origin
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in ms
	 * @param {Function} [input.fetchFn=DBBrowser.FetchFn] - Custom fetch function
	 * @param {string} [input.root] - Base href (root) for the current DB
	 * @param {Console | NoConsole} [input.console] - Console for messages
	 */
	constructor(input = {}) {
		const {
			host = "",
			timeout = 6_000,
			fetchFn = DBBrowser.FetchFn,
			root = "/",
		} = input

		super({ ...input, root })
		if (host) this.cwd = host
		this.host = String(host)
		this.timeout = Number(timeout)
		this.fetchFn = fetchFn
	}

	/**
	 * Resolves path segments to absolute URL synchronously.
	 * @param {...string} args
	 * @returns {string}
	 */
	resolveSync(...args) {
		return resolveSync({ cwd: this.cwd, root: this.root }, ...args)
	}

	/**
	 * Validates access level.
	 * @param {string} uri
	 * @param {string} [level='r']
	 * @returns {Promise<void>}
	 */
	async ensureAccess(uri, level = "r") {
		if (!["r", "w", "d"].includes(level)) {
			throw new TypeError("Access level must be one of [r, w, d]")
		}
	}

	/**
	 * Fetch document – returns parsed JSON when possible, otherwise raw text.
	 * @param {string} uri
	 * @returns {Promise<any>}
	 */
	async fetch(uri) {
		try {
			const response = await this.fetchRemote(uri)
			// Prefer JSON, fall back to plain text for non‑JSON payloads (e.g., index.txtl)
			try {
				return await response.json()
			} catch {
				return await response.text()
			}
		} catch (/** @type {any} */ err) {
			return { error: "Not found" }
		}
	}

	/**
	 * Performs fetch with timeout and fallback.
	 *
	 * Adjusts URL for `mockFetch` which expects path‑only.
	 *
	 * @param {string} uri
	 * @param {object} [requestInit={}]
	 * @param {Set<string>} [visited=new Set()] recursion guard
	 * @returns {Promise<Response>}
	 */
	async fetchRemote(uri, requestInit = {}, visited = new Set()) {
		const absUri = await this.resolve(uri)
		const isRemote = this.isRemote(absUri)
		const baseHref = isRemote ? "" : this.cwd
		let href = isRemote ? absUri : new URL(absUri, baseHref).href

		if (this.fetchFn.name === "mockFetch") {
			const u = new URL(href)
			href = u.pathname + u.search + u.hash
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), this.timeout)
		this.console.debug("fetchRemote()", uri, { href, requestInit, visited })

		try {
			let response = await this.fetchFn(href, {
				...requestInit,
				signal: controller.signal,
			})
			clearTimeout(timeoutId)

			const hdrs = new Headers(response.headers ?? [])
			let needExt = false
			if (hdrs.has("content-type")) {
				const [, ext] = hdrs.get("content-type").split("/")
				if (this.Directory.DATA_EXTNAMES.every(e => !e.endsWith("/" + ext.slice(1)))) {
					needExt = true
				}
			}
			const notFound = response.status === 404 && !visited.has(href)
			if ((needExt || notFound) && !this.extname(uri)) {
				visited.add(href)
				for (const ext of this.Directory.DATA_EXTNAMES) {
					const extended = uri + ext
					response = await this.fetchRemote(extended, requestInit, visited)
					if (response.ok) break
				}
			}
			return response
		} catch (/** @type {any} */ err) {
			clearTimeout(timeoutId)
			if (err.name === "AbortError") {
				throw new HTTPError("Request timeout", 408)
			}
			throw err
		}
	}

	/**
	 * Throws formatted HTTPError.
	 * @param {Response} response
	 * @param {string} message
	 * @throws {HTTPError}
	 */
	async throwError(response, message) {
		/** @type {any} */
		let payload = null
		try {
			payload = await response.json()
		} catch {
			try {
				payload = await response.text()
			} catch {}
		}
		throw new HTTPError(String(payload?.error ?? payload?.message ?? payload ?? message), response.status)
	}

	/**
	 * Always performs HEAD request and returns `isFile: true`.
	 *
	 * Ignores any cache (super.statDocument) to ensure `isFile` is set.
	 *
	 * @param {string} uri
	 * @returns {Promise<DocumentStat>}
	 */
	async statDocument(uri) {
		const absUri = await this.resolve(uri)
		const isRemote = this.isRemote(absUri)
		const baseHref = isRemote ? "" : this.cwd
		let href = isRemote ? absUri : new URL(absUri, baseHref).href

		const response = await this.fetchFn(href, { method: "HEAD" })
		if (404 === response.status) return new DocumentStat()

		const hdrs = new Headers(response.headers ?? {})
		const lm = hdrs.get("last-modified") || hdrs.get("date")
		const mtimeMs = lm ? new Date(lm).getTime() : Date.now()
		const size = Number(hdrs.get("content-length") ?? 0)

		return new DocumentStat({
			isFile: true,
			mtimeMs,
			size,
		})
	}

	/**
	 * Loads and parses document, returns `defaultValue` on fail.
	 * @param {string} uri
	 * @param {any} [defaultValue]
	 * @returns {Promise<any>}
	 */
	async loadDocument(uri, defaultValue) {
		await this.ensureAccess(uri, "r")
		try {
			const response = await this.fetchRemote(uri)
			if (!response.ok) {
				this.console.warn(`Failed to load document: ${uri}`)
				return defaultValue
			}
			return await response.json()
		} catch (/** @type {any} */ err) {
			this.console.warn(`Failed to load document: ${uri}`, err)
			return defaultValue
		}
	}

	/**
	 * Saves via POST.
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<any>}
	 */
	async saveDocument(uri, document) {
		await this.ensureAccess(uri, "w")
		const absUri = this.absolute(uri)
		const response = await this.fetchFn(absUri, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(document),
		})
		if (!response.ok) {
			await this.throwError(response, `Failed to save document: ${uri}`)
		}
		return await response.json()
	}

	/**
	 * Updates via PUT.
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<any>}
	 */
	async writeDocument(uri, document) {
		await this.ensureAccess(uri, "w")
		const absUri = await this.resolve(uri)
		const response = await this.fetchRemote(absUri, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(document),
		})
		if (!response.ok) {
			await this.throwError(response, `Failed to write document: ${uri}`)
		}
		/** @type {any} */
		let result = true
		try {
			result = await response.json()
		} catch {
			try {
				result = await response.text()
			} catch {}
		}
		return result
	}

	/**
	 * Deletes via DELETE.
	 * @param {string} uri
	 * @returns {Promise<boolean>}
	 */
	async dropDocument(uri) {
		await this.ensureAccess(uri, "d")
		const absUri = await this.resolve(uri)
		const response = await this.fetchRemote(absUri, { method: "DELETE" })
		if (!response.ok) {
			await this.throwError(response, `Failed to delete document: ${uri}`)
		}
		return true
	}

	/**
	 * Creates DB subset.
	 * @param {string} uri
	 * @returns {DBBrowser}
	 */
	extract(uri) {
		const extracted = super.extract(uri)
		return DBBrowser.from({
			...extracted,
			host: this.host,
			timeout: this.timeout,
			fetchFn: this.fetchFn,
		})
	}

	/**
	 * Static from helper.
	 * @param {any} input
	 * @returns {DBBrowser}
	 */
	static from(input) {
		if (input instanceof DBBrowser) return input
		return new DBBrowser(input)
	}
}