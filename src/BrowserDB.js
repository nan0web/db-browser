import DB from "@nan0web/db"
import { HTTPError } from "@nan0web/http"
import BrowserDirectory from "./Directory.js"

/**
 * @goal
 * # Browser Database
 * Every source of data can be a part of your database.
 *
 * BrowserDB extends DB for browser usage for loading, saving, writing, and deleting
 * documents, so a standard GET, POST, PUT, DELETE operations.
 *
 * ## Requirements
 * - Every function and property must be jsdoc'ed with type (at least);
 * - Every public function must be tested;
 * - Every known vulnerability must be included in test;
 */
class BrowserDB extends DB {
	static Directory = BrowserDirectory
	static FetchOptions = DB.FetchOptions

	/** @type {Function} */
	static FetchFn = typeof window !== 'undefined'
		? window.fetch.bind(window)
		: async () => { throw new Error('Fetch not available in this environment') }

	/** @type {string} */
	// me = ''
	/** @type {number} */
	timeout = 6_000
	/** @type {Function} */
	fetchFn = BrowserDB.FetchFn

	/**
	 * @param {object} [input]
	 * @param {string} [input.host] - window.location.origin
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
	 * @param {Function} [input.fetchFn] - Custom fetch function
	 * @param {string} [input.root] - Base href (root) for the current DB
	 * @param {Console} [input.console] - The console for messages
	 */
	constructor(input = {}) {
		const {
			/**
			 * @note window.location.origin returns null in happy-dom.
			 */
			host = "undefined" === typeof window || "null" === window.location.origin
				? "http://localhost" : window.location.origin,
			// me = "",
			timeout = 6_000,
			fetchFn = BrowserDB.FetchFn,
			root = "/",
			console: initialConsole = console,
		} = input
		super({ ...input, root })
		if (host) {
			this.cwd = host
		}
		// this.me = String(me)
		this.timeout = Number(timeout)
		this.fetchFn = fetchFn
		this.console = initialConsole
	}

	get host() {
		return this.cwd
	}

	async connect() {
		await super.connect()
		if ("undefined" === typeof window) {
			console.error("Window.fetch must be a function")
		}
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
	 * @param {...string} args - URI components to resolve
	 * @returns {Promise<string>} Resolved URI
	 */
	async resolve(...args) {
		return args.join("/").split("://").map(s => s.replace(/\/{2,}/g, "/")).join("://")
	}

	/**
	 * Fetches a document with authentication headers if available
	 * @param {string} uri - The URI to fetch
	 * @param {object} [requestInit={}] - Fetch request initialization options
	 * @returns {Promise<Response>} Fetch response
	 */
	async fetchRemote(uri, requestInit = {}) {
		try {
			const url = await this.resolve(this.cwd, this.root)
			const href = new URL(uri, url).href

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
					const [,contentExt] = headers.get("content-type").split("/")
					if (this.Directory.DATA_EXTNAMES.every(e => !e.endsWith("/" + contentExt.slice(1)))) {
						check = true
					}
				}
				if (check && !this.extname(uri)) {
					for (const ext of this.Directory.DATA_EXTNAMES) {
						const href = uri + ext
						response = await this.fetchRemote(href, requestInit)
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
			return localIndex || {}
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
	 * @override
	 * @param {string} uri
	 * @param {any} [defaultValue]
	 * @returns {Promise<any>}
	 */
	async loadDocument(uri, defaultValue) {
		await this.ensureAccess(uri, 'r')
		const response = await this.fetchRemote(uri)
		if (!response.ok) {
			console.warn(["Failed to load document", uri].join(": "))
			return defaultValue
		}
		return response.json()
	}

	/**
	 * @override
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<boolean>}
	 */
	async saveDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const response = await this.fetchFn(uri, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(document)
		})
		if (!response.ok) {
			await this.throwError(response, ["Failed to save document", uri].join(": "))
		}
		return response.json()
	}

	/**
	 * @override
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<any>}
	 */
	async writeDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const response = await this.fetchRemote(uri, {
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
			} catch {}
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
		const response = await this.fetchRemote(uri, { method: 'DELETE' })
		if (!response.ok) {
			await this.throwError(response, ["Failed to delete document", uri].join(": "))
		}
		return true
	}
}

export default BrowserDB
