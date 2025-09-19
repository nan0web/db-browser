import DB, { DocumentStat, DocumentEntry } from "@nan0web/db"
import { HTTPError } from "@nan0web/http"
import BrowserDirectory from "./Directory.js"
import { NoConsole } from "@nan0web/log"
import resolveSync from "./utils/resolveSync.js"

/**
 * @goal
 * # Browser Database
 * Every source of data can be a part of your database.
 *
 * DBBrowser extends DB for browser usage for loading, saving, writing, and deleting
 * documents, so a standard GET, POST, PUT, DELETE operations.
 *
 * ## Requirements
 * - Every function and property must be jsdoc'ed with type (at least);
 * - Every public function must be tested;
 * - Every known vulnerability must be included in test;
 */
class DBBrowser extends DB {
	static Directory = BrowserDirectory
	static FetchOptions = DB.FetchOptions

	/** @type {Function | null} */
	static #FetchFn = null

	/** @type {Function} */
	static get FetchFn() {
		if (this.#FetchFn) return this.#FetchFn
		if (typeof window !== 'undefined' && window.fetch) {
			this.#FetchFn = window.fetch.bind(window)
		} else {
			this.#FetchFn = async () => {
				throw new Error('Fetch not available in this environment')
			}
		}
		return this.#FetchFn
	}

	/** @type {string} */
	host = ''
	/** @type {number} */
	timeout = 6_000

	/**
	 * The fetch function used by this specific instance.
	 * @type {Function}
	 */
	fetchFn = DBBrowser.FetchFn

	/**
	 * @param {object} [input]
	 * @param {string} [input.host] - window.location.origin
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in milliseconds (default: 6000 ms)
	 * @param {Function} [input.fetchFn=DBBrowser.FetchFn] - Custom fetch function
	 * @param {string} [input.root] - Base href (root) for the current DB
	 * @param {Console | NoConsole} [input.console] - The console for messages
	 */
	constructor(input = {}) {
		const {
			host = "",
			timeout = 6_000,
			fetchFn = DBBrowser.FetchFn,
			root = "/",
		} = input

		super({ ...input, root })
		if (host) {
			this.cwd = host
		}
		this.host = String(host)
		this.timeout = Number(timeout)
		this.fetchFn = fetchFn
	}

	/**
	 * Resolves path segments to absolute URL synchronously
	 * @param {...string} args - Path segments
	 * @returns {string} Resolved absolute URL
	 */
	resolveSync(...args) {
		return resolveSync({ cwd: this.cwd, root: this.root }, ...args)
	}

	/**
	 * @param {string} uri
	 * @param {string} level
	 * @returns {Promise<void>}
	 */
	async ensureAccess(uri, level = 'r') {
		if (!["r", "w", "d"].includes(level)) {
			throw new TypeError('Access level must be one of [r, w, d]')
		}
	}

	/**
	 * Fetches a document with authentication headers if available
	 * @param {string} uri - The URI to fetch
	 * @param {object} [requestInit={}] - Fetch request initialization options
	 * @returns {Promise<Response>} Fetch response
	 */
	async fetchRemote(uri, requestInit = {}, visited = new Set()) {
		try {
			const absUri = await this.resolve(uri)
			const href = this.isRemote(absUri) ? absUri : new URL(absUri, this.cwd).href

			// Add timeout handling
			const controller = new AbortController()
			const timeoutId = setTimeout(() => {
				controller.abort()
			}, this.timeout)

			try {
				let response = await this.fetchFn(href, {
					...requestInit,
					signal: controller.signal
				})
				clearTimeout(timeoutId)
				let check = false
				const headers = new Map(response.headers ?? [])
				if (headers.has("content-type")) {
					const [, contentExt] = headers.get("content-type").split("/")
					if (this.Directory.DATA_EXTNAMES.every(e => !e.endsWith("/" + contentExt.slice(1)))) {
						check = true
					}
				}
				const notFound = 404 === response.status && !visited.has(href)
				if ((check || notFound) && !this.extname(uri)) {
					visited.add(href)
					for (const ext of this.Directory.DATA_EXTNAMES) {
						const extendedUri = uri + ext
						response = await this.fetchRemote(extendedUri, requestInit, visited)
						if (response.ok) {
							break
						}
					}
				}
				return response
			} catch (/** @type {any} */ err) {
				clearTimeout(timeoutId)
				if (err.name === 'AbortError') {
					throw new HTTPError('Request timeout', 408)
				}
				throw err
			}
		} catch (err) {
			// Handle error properly by re-throwing it
			throw err
		}
	}

	/**
	 * Load indexes from local or global index file
	 * @returns {Promise<Record<string, any>>}
	 */
	async load() {
		try {
			const localIndex = await this.fetchRemote(this.Directory.INDEX)
			return await localIndex.json() || {}
		} catch (e) {
			return {}
		}
	}

	/**
	 * Throw an HTTPError with appropriate message from response
	 * @param {Response} response - Response object to extract error message from
	 * @param {string} message - Default error message
	 * @throws {HTTPError} Throws formatted error message
	 */
	async throwError(response, message) {
		/** @type {any} */
		let json = null
		try { json = await response.json() } catch {
			try { json = await response.text() } catch { }
		}
		throw new HTTPError(
			String(json?.error ?? json?.message ?? json ?? message), response.status
		)
	}

	/**
	 * Get document statistics (file metadata) from remote server using HEAD request
	 * @param {string} uri - The URI of the document to get stats for
	 * @returns {Promise<DocumentStat>} Document statistics object
	 */
	async statDocument(uri) {
		const stat = await super.statDocument(uri)
		if (stat.exists) return stat
		const response = await this.fetchRemote(uri, { method: 'HEAD' })
		if (404 === response.status) return new DocumentStat()

		const headers = new Map(response.headers ?? [])
		const lastModified = headers.get("Last-Modified") || headers.get("Date")
		const mtimeMs = lastModified ? new Date(lastModified).getTime() : 0

		return new DocumentStat({
			isFile: true,
			mtimeMs,
			size: Number(headers.get("Content-Length") || 0),
		})
	}

	/**
	 * @override
	 * @param {string} uri
	 * @param {any} [defaultValue]
	 * @returns {Promise<any>}
	 */
	async loadDocument(uri, defaultValue) {
		await this.ensureAccess(uri, 'r')
		const absUri = await this.resolve(uri)
		const response = await this.fetchRemote(absUri)
		if (!response.ok) {
			this.console.warn(["Failed to load document", uri].join(": "))
			return defaultValue
		}
		return await response.json()
	}

	/**
	 * @override
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<boolean>}
	 */
	async saveDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const absUri = this.absolute(uri)
		const response = await this.fetchFn(absUri, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(document)
		})
		if (!response.ok) {
			await this.throwError(response, ["Failed to save document", uri].join(": "))
		}
		return await response.json()
	}

	/**
	 * @override
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<any>}
	 */
	async writeDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const absUri = await this.resolve(uri)
		const response = await this.fetchRemote(absUri, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(document)
		})
		if (!response.ok) {
			await this.throwError(response, ["Failed to write document", uri].join(": "))
		}
		/** @type {any} */
		let result = true
		try {
			result = await response.json()
		} catch {
			try {
				result = await response.text()
			} catch { }
		}
		return result
	}

	/**
	 * @override
	 * @param {string} uri
	 * @returns {Promise<boolean>}
	 */
	async dropDocument(uri) {
		await this.ensureAccess(uri, 'd')
		const absUri = await this.resolve(uri)
		const response = await this.fetchRemote(absUri, { method: 'DELETE' })
		if (!response.ok) {
			await this.throwError(response, ["Failed to delete document", uri].join(": "))
		}
		return true
	}

	/**
	 * Creates a new DB instance with a subset of the data and meta.
	 * @param {string} uri The URI to extract from the current DB.
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
	 * @override
	 * @param {string} uri
	 * @param {object} options
	 * @yields {DocumentEntry}
	 * @returns {AsyncGenerator<DocumentEntry, void, unknown>}
	 */
	async *readDir(uri, options = {}) {
		const dirUri = await this.resolve(uri)

		// Load index files from the directory first
		const indexUri = this.resolveSync(dirUri, this.Index.INDEX)
		const fullIndexUri = this.resolveSync(dirUri, this.Index.FULL_INDEX)

		try {
			// Try to load JSONL index (full recursive structure)
			const response = await this.fetchRemote(fullIndexUri)
			if (response.ok) {
				const entries = await response.json()
				for (const entry of entries) {
					yield entry
				}
				return
			}
		} catch (err) {
			this.console.warn(["Failed to load full index", fullIndexUri].join(": "))
		}

		try {
			// Try to load TXT index (immediate children only)
			const response = await this.fetchRemote(indexUri)
			if (response.ok) {
				const entries = await response.json()
				for (const entry of entries) {
					yield entry
				}
				return
			}
		} catch (err) {
			this.console.warn(["Failed to load index", indexUri].join(": "))
		}

		// Fallback to parent implementation
		yield* super.readDir(uri, { depth: 1, ...options })
	}

	/**
	 * @param {any} input
	 * @returns {DBBrowser}
	 */
	static from(input) {
		if (input instanceof DBBrowser) return input
		return new DBBrowser(input)
	}
}

export default DBBrowser
