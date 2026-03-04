import DB, { DocumentStat, DocumentEntry } from '@nan0web/db'
import { HTTPError } from '@nan0web/http'
import { NoConsole } from '@nan0web/log'
import BrowserDirectory from './Directory.js'
import BrowserStore from './BrowserStore.js'
import { resolveSync } from './utils/resolveSync.js'

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
	fetchFn = DBBrowser.FetchFn

	/**
	 * @param {object} [input]
	 * @param {string} [input.host] - window.location.origin
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
	 * @param {Function} [input.fetchFn=DBBrowser.FetchFn] - Custom fetch function
	 * @param {string} [input.root] - Base href (root) for the current DB
	 * @param {Console | NoConsole} [input.console] - The console for messages
	 */
	constructor(input = {}) {
		const { host = '', timeout = 6_000, fetchFn = DBBrowser.FetchFn, root = '/' } = input

		super({ ...input, root })
		if (host) this.cwd = host
		this.host = String(host)
		this.timeout = Number(timeout)
		this.fetchFn = fetchFn
		this.store = new BrowserStore()
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
	async ensureAccess(uri, level = 'r') {
		if (!['r', 'w', 'd'].includes(level)) {
			throw new TypeError('Access level must be one of [r, w, d]')
		}
	}

	/**
	 * Primary fetch logic — override for browser HTTP fetching.
	 * Base `DB.fetch()` delegates here, providing mount routing,
	 * fallback chain, and model hydration around this method.
	 *
	 * @param {string} uri
	 * @returns {Promise<any>}
	 */
	async _fetchPrimary(uri) {
		try {
			const response = await this.fetchRemote(uri)
			if (!response.ok) {
				const cached = await this.store.get(uri)
				if (cached) return cached.data
				return undefined
			}
			// Prefer JSON, fall back to plain text for non‑JSON payloads (e.g., index.txtl)
			let data
			try {
				data = await response.json()
			} catch {
				data = await response.text()
			}
			this.store.put(uri, data, { unsynced: false }).catch(() => {})
			return data
		} catch (/** @type {any} */ err) {
			const cached = await this.store.get(uri)
			if (cached) return cached.data
			return undefined
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
		// Proactive .json extension: avoid 404/403 console noise for extension-less URIs
		if (!this.extname(uri) && !visited.has(uri) && this.Directory.DATA_EXTNAMES.includes('.json')) {
			visited.add(uri)
			const extended = uri + '.json'
			const response = await this.fetchRemote(extended, requestInit, visited)
			if (response.ok) return response
			// fallback to original URI if .json doesn't exist
		}

		const absUri = await this.resolve(uri)
		const isRemote = this.isRemote(absUri)
		const baseHref = isRemote ? '' : this.cwd
		let href = isRemote ? absUri : new URL(absUri, baseHref).href

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), this.timeout)
		this.console.debug('fetchRemote()', uri, { href, requestInit, visited })

		try {
			let response = await this.fetchFn(href, {
				...requestInit,
				signal: controller.signal,
			})
			clearTimeout(timeoutId)

			const hdrs = new Headers(response.headers ?? [])
			let needExt = false
			if (hdrs.has('content-type')) {
				const [, ext] = hdrs.get('content-type').split('/')
				if (this.Directory.DATA_EXTNAMES.every((e) => !e.endsWith('/' + ext.slice(1)))) {
					needExt = true
				}
			}
			const notFound = (response.status === 404 || response.status === 403) && !visited.has(href)
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
			if (err.name === 'AbortError') {
				throw new HTTPError('Request timeout', 408)
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
		throw new HTTPError(
			String(payload?.error ?? payload?.message ?? payload ?? message),
			response.status,
		)
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
		const response = await this.fetchRemote(uri, { method: 'HEAD' })
		if (404 === response.status) return new DocumentStat()

		const hdrs = new Headers(response.headers ?? {})
		const lm = hdrs.get('last-modified') || hdrs.get('date')
		const mtimeMs = lm ? new Date(lm).getTime() : Date.now()
		const size = Number(hdrs.get('content-length') ?? 0)

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
		await this.ensureAccess(uri, 'r')
		try {
			const response = await this.fetchRemote(uri)
			if (!response.ok) {
				this.console.warn(`Failed to load document: ${uri}`)
				const cached = await this.store.get(uri)
				if (cached) return cached.data
				return defaultValue
			}
			// Prefer JSON, fall back to plain text for non‑JSON payloads (e.g., index.txtl)
			let data
			try {
				data = await response.json()
			} catch {
				data = await response.text()
			}
			this.store.put(uri, data, { unsynced: false }).catch(() => {})
			return data
		} catch (/** @type {any} */ err) {
			this.console.warn(`Failed to load document: ${uri}`, err)
			const cached = await this.store.get(uri)
			if (cached) return cached.data
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
		await this.ensureAccess(uri, 'w')
		const absUri = await this.resolve(uri)
		try {
			const response = await this.fetchRemote(absUri, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(document),
			})
			if (!response.ok) {
				await this.throwError(response, `Failed to save document: ${uri}`)
			}
			const result = await response.json()
			this.store.put(uri, document, { unsynced: false }).catch(() => {})
			this.emit('change', { uri, type: 'save', data: document })
			return result
		} catch (/** @type {any} */ err) {
			if (err instanceof HTTPError && ![408, 502, 503, 504].includes(err.status)) throw err
			await this.store.put(uri, document, { unsynced: true, method: 'POST' })
			return document
		}
	}

	/**
	 * Updates via PUT.
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<any>}
	 */
	async writeDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const absUri = await this.resolve(uri)
		try {
			const response = await this.fetchRemote(absUri, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
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
			this.store.put(uri, document, { unsynced: false }).catch(() => {})
			return result
		} catch (/** @type {any} */ err) {
			if (err instanceof HTTPError && ![408, 502, 503, 504].includes(err.status)) throw err
			await this.store.put(uri, document, { unsynced: true, method: 'PUT' })
			return true
		}
	}

	/**
	 * Deletes via DELETE.
	 * @param {string} uri
	 * @returns {Promise<boolean>}
	 */
	async dropDocument(uri) {
		await this.ensureAccess(uri, 'd')
		const absUri = await this.resolve(uri)
		try {
			const response = await this.fetchRemote(absUri, { method: 'DELETE' })
			if (!response.ok) {
				await this.throwError(response, `Failed to delete document: ${uri}`)
			}
			this.store.remove(uri).catch(() => {})
			this.emit('change', { uri, type: 'drop' })
			return true
		} catch (/** @type {any} */ err) {
			if (err instanceof HTTPError && ![408, 502, 503, 504].includes(err.status)) throw err
			await this.store.put(uri, null, { unsynced: true, method: 'DELETE' })
			return true
		}
	}

	/**
	 * Synchronizes offline changes with the server.
	 * @returns {Promise<number>} Number of synchronized documents
	 */
	async sync() {
		const pending = await this.store.getAllUnsynced()
		let syncedCount = 0
		for (const item of pending) {
			try {
				if (item.method === 'DELETE') {
					await this.dropDocument(item.uri)
				} else if (item.method === 'PUT') {
					await this.writeDocument(item.uri, item.data)
				} else {
					await this.saveDocument(item.uri, item.data)
				}
				syncedCount++
			} catch (e) {
				this.console.warn(`Failed to sync ${item.uri}:`, e)
			}
		}
		return syncedCount
	}

	/**
	 * Creates DB subset.
	 *
	 * The original DBBrowser stores `root` with a leading slash (e.g. "/data/").
	 * For the README‑based example we need a *relative* root without the leading slash,
	 * and `cwd` must stay as the original host URL.
	 *
	 * @param {string} uri
	 * @returns {DBBrowser}
	 */
	extract(uri) {
		// Normalise original root (strip leading/trailing slashes)
		const cleanRoot = this.root.replace(/^\/+|\/+$/g, '')
		// Ensure uri does not start with a slash
		const cleanUri = uri.replace(/^\/+/, '')
		// Build new relative root:  "<originalRoot>/<uri>"
		const newRoot = cleanRoot ? `${cleanRoot}/${cleanUri}` : cleanUri

		// Ensure trailing slash for directory semantics
		const finalRoot = newRoot.endsWith('/') ? newRoot : `${newRoot}/`

		return DBBrowser.from({
			host: this.host,
			root: finalRoot,
			timeout: this.timeout,
			fetchFn: this.fetchFn,
			console: this.console,
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
