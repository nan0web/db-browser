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
			host = "",
			timeout = 6_000,
			fetchFn = BrowserDB.FetchFn,
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

	async connect() {
		await super.connect()
		if ("undefined" === typeof window) {
			this.console.error("Window.fetch must be a function")
		}
		else if (!this.host) {
			// this.host = window.location.origin
			// this.cwd = window.location.origin
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

	resolveSync(...args) {
		if (args.length === 0) {
			return this.cwd + this.root
		}

		const urls = args.map(arg => new URL(arg, this.cwd + this.root))
		const hosts = urls.map(url => url.origin)
		const uniqueHosts = new Set(hosts)

		if (uniqueHosts.size > 1) {
			return args[args.length - 1]
		}

		const paths = urls.map((url, i) => {
			return args[i].startsWith("..") ? `../${url.pathname.slice(1)}`
				: args[i].startsWith("/") ? url.pathname : url.pathname.slice(1)
		})

		// Handle query parameters and fragments from the last URL
		const lastUrl = urls[urls.length - 1]
		const search = lastUrl.search ? lastUrl.search : ''
		const hash = lastUrl.hash ? lastUrl.hash : ''

		let segments = []
		for (const p of paths) {
			if (p.startsWith("/")) segments = []
			segments.push(p)
		}

		const pathname = super.resolveSync(...paths)
		let host = uniqueHosts.values().next().value || this.cwd
		if (host === this.cwd) host = ""
		return host + (pathname.startsWith("/") ? pathname : `/${pathname}`) + search + hash
	}

	/**
	 * Fetches a document with authentication headers if available
	 * @param {string} uri - The URI to fetch
	 * @param {object} [requestInit={}] - Fetch request initialization options
	 * @returns {Promise<Response>} Fetch response
	 */
	async fetchRemote(uri, requestInit = {}, visited = new Set()) {
		try {
			let url = await this.resolve(this.cwd, this.root)
			if (!url.includes("//")) url = this.cwd + url
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
					const [, contentExt] = headers.get("content-type").split("/")
					if (this.Directory.DATA_EXTNAMES.every(e => !e.endsWith("/" + contentExt.slice(1)))) {
						check = true
					}
				}
				const notFound = 404 === response.status && !visited.has(href)
				if ((check || notFound) && !this.extname(uri)) {
					visited.add(href)
					for (const ext of this.Directory.DATA_EXTNAMES) {
						const href = uri + ext
						response = await this.fetchRemote(href, requestInit, visited)
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
		const response = await this.fetchRemote(uri, { method: 'DELETE' })
		if (!response.ok) {
			await this.throwError(response, ["Failed to delete document", uri].join(": "))
		}
		return true
	}
}

export default BrowserDB
