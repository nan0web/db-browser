import DB from "@nanoweb/db"
import { oneOf } from "@nanoweb/types"
import { HTTPResponseMessage, HTTPError } from "@nanoweb/http"

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
	static #EmptyFn = () => ({
		ok: false,
		json: async () => ({ error: "fetchFn() not implemented and no window.fetch()" }),
	})
	static FetchFn = "undefined" === typeof window ? BrowserDB.#EmptyFn : window.fetch
	/** @type {string} */
	me = ''
	/** @type {string} */
	extension = '.json'
	/** @type {string} */
	indexFile = 'index.json'
	/** @type {string} */
	localIndexFile = 'index.d.json'
	/** @type {number} */
	timeout
	/** @type {Function} */
	fetchFn

	/**
	 * @param {object} input
	 * @param {string} [input.host] - window.location.origin
	 * @param {string} [input.extension='.json']
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
	 * @param {Function} [input.fetchFn] - Custom fetch function, @nanoweb/http for node.js.
	 */
	constructor(input = {}) {
		const {
			host = "undefined" === typeof window ? "http://localhost" : window.location.origin,
			me = "",
			extension = ".json",
			indexFile = "index.json",
			localIndexFile = "index.d.json",
			timeout = 6_000,
			fetchFn = BrowserDB.FetchFn,
			root = "/",
		} = input
		super({ ...input, root })
		if (host) {
			this.cwd = host
		}
		this.me = String(me)
		this.extension = String(extension)
		this.indexFile = String(indexFile)
		this.localIndexFile = String(localIndexFile)
		this.timeout = Number(timeout)
		this.fetchFn = fetchFn
	}

	get host() {
		return this.cwd
	}

	/**
	 * @param {string} uri
	 * @param {string} level
	 * @returns {Promise<boolean>}
	 */
	async ensureAccess(uri, level = 'r') {
		if (!oneOf('r', 'w', 'd')(level)) {
			throw new TypeError('Access level must be one of [r, w, d]')
		}
		return true
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
	 * @returns {Promise<HTTPResponseMessage>} Fetch response
	 */
	async fetch(uri, requestInit = {}) {
		try {
			const url = await this.resolve(this.cwd, this.root)
			const href = new URL(uri, url).href

			// Add timeout handling
			const controller = new AbortController()
			const timeoutId = setTimeout(() => {
				controller.abort()
			}, this.timeout)

			try {
				const response = await this.fetchFn(href, {
					...requestInit,
					signal: controller.signal
				})
				clearTimeout(timeoutId)
				return response
			} catch (err) {
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
			const localIndex = await this.loadDocument(this.localIndexFile)
			if (localIndex) return localIndex
		} catch (e) {
			// Ignore local index failure
		}

		try {
			const globalIndex = await this.loadDocument(this.indexFile)
			return globalIndex || {}
		} catch (e) {
			return {}
		}
	}

	/**
	 * Throw an HTTPError with appropriate message from response
	 * @param {HTTPResponseMessage} response - Response object to extract error message from
	 * @param {string} message - Default error message
	 * @throws {HTTPError} Throws formatted error message
	 */
	async throwError(response, message) {
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
	 * @returns {Promise<any>}
	 */
	async loadDocument(uri) {
		await this.ensureAccess(uri, 'r')
		const response = await this.fetch(uri)
		if (!response.ok) {
			await this.throwError(response, ["Failed to load document", uri].join(": "))
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
		const response = await this.fetch(uri, {
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
	 * @returns {Promise<boolean>}
	 */
	async writeDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const response = await this.fetch(uri, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(document)
		})
		if (!response.ok) {
			await this.throwError(response, ["Failed to write document", uri].join(": "))
		}
		return response.json()
	}

	/**
	 * @override
	 * @param {string} uri
	 * @returns {Promise<boolean>}
	 */
	async dropDocument(uri) {
		await this.ensureAccess(uri, 'd')
		const response = await this.fetch(uri, { method: 'DELETE' })
		if (!response.ok) {
			await this.throwError(response, ["Failed to delete document", uri].join(": "))
		}
		return true
	}

}

export default BrowserDB
