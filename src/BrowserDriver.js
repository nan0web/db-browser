import { DBDriverProtocol, DocumentStat } from '@nan0web/db'

export default class BrowserDriver extends DBDriverProtocol {
	static DB_NAME = 'nan0db'
	static STORE_NAME = 'documents'
	static CACHE_STORE = 'cache'

	constructor(input = {}) {
		super(input)
		this.db = null
		this.connected = false
		this._cache = new Map()
		this._metaCache = new Map()
	}

	/** @returns {string} */
	get DB_NAME() {
		return /** @type {typeof BrowserDriver} */ (this.constructor).DB_NAME
	}

	/** @returns {string} */
	get STORE_NAME() {
		return /** @type {typeof BrowserDriver} */ (this.constructor).STORE_NAME
	}

	/** @returns {string} */
	get CACHE_STORE() {
		return /** @type {typeof BrowserDriver} */ (this.constructor).CACHE_STORE
	}

	/**
	 * Connects to IndexedDB.
	 * @returns {Promise<void>}
	 */
	async connect() {
		/** @type {Promise<void>} */
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, 1)

			request.onerror = () => reject(new Error('Failed to open IndexedDB'))
			request.onsuccess = () => {
				this.db = request.result
				this.connected = true
				resolve()
			}

			request.onupgradeneeded = () => {
				const db = request.result
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					db.createObjectStore(this.STORE_NAME)
				}
				if (!db.objectStoreNames.contains(this.CACHE_STORE)) {
					db.createObjectStore(this.CACHE_STORE)
				}
			}
		})
	}

	/**
	 * Disconnects from IndexedDB and clears caches.
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		if (this.db) {
			this.db.close()
			this.db = null
			this.connected = false
			this._cache.clear()
			this._metaCache.clear()
		}
	}

	/**
	 * @param {'readonly'|'readwrite'} [mode='readonly']
	 * @returns {IDBObjectStore}
	 */
	_getStore(mode = 'readonly') {
		if (!this.db) throw new Error('Database not connected')
		return this.db.transaction(this.STORE_NAME, /** @type {IDBTransactionMode} */ (mode)).objectStore(this.STORE_NAME)
	}

	/**
	 * @param {'readonly'|'readwrite'} [mode='readonly']
	 * @returns {IDBObjectStore}
	 */
	_getCacheStore(mode = 'readonly') {
		if (!this.db) throw new Error('Database not connected')
		return this.db.transaction(this.CACHE_STORE, /** @type {IDBTransactionMode} */ (mode)).objectStore(this.CACHE_STORE)
	}

	/**
	 * Reads a document from the store (with in‑memory cache fallback).
	 * @param {string} uri
	 * @returns {Promise<any>}
	 */
	async read(uri) {
		// Check in-memory cache first
		if (this._cache.has(uri)) {
			return this._cache.get(uri)
		}

		const store = this._getStore()
		const request = store.get(uri)

		return new Promise((resolve, reject) => {
			request.onerror = () => reject(new Error(`Failed to read ${uri}`))
			request.onsuccess = () => {
				const data = request.result
				this._cache.set(uri, data)
				resolve(data)
			}
		})
	}

	/**
	 * Writes a document to the store.
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<boolean>}
	 */
	async write(uri, document) {
		const store = this._getStore('readwrite')
		const request = store.put(document, uri)

		return new Promise((resolve, reject) => {
			request.onerror = () => reject(new Error(`Failed to write ${uri}`))
			request.onsuccess = () => {
				this._cache.set(uri, document)
				resolve(true)
			}
		})
	}

	/**
	 * Appends (concatenates) a chunk to an existing document.
	 * @param {string} uri
	 * @param {string} chunk
	 * @returns {Promise<boolean>}
	 */
	async append(uri, chunk) {
		const current = await this.read(uri) || ''
		const updated = current + chunk
		return this.write(uri, updated)
	}

	/**
	 * @param {string} uri
	 * @returns {Promise<DocumentStat>}
	 */
	async stat(uri) {
		if (this._metaCache.has(uri)) {
			return this._metaCache.get(uri)
		}

		const document = await this.read(uri)
		const size = new Blob([JSON.stringify(document)]).size
		const stat = new DocumentStat({
			size,
			mtimeMs: Date.now(),
			isFile: true
		})

		this._metaCache.set(uri, stat)
		return stat
	}

	/**
	 * Deletes a document from the store.
	 * @param {string} uri
	 * @returns {Promise<boolean>}
	 */
	async delete(uri) {
		const store = this._getStore('readwrite')
		const request = store.delete(uri)

		return new Promise((resolve, reject) => {
			request.onerror = () => reject(new Error(`Failed to delete ${uri}`))
			request.onsuccess = () => {
				this._cache.delete(uri)
				this._metaCache.delete(uri)
				resolve(true)
			}
		})
	}

	/**
	 * Lists child URIs under a directory.
	 *
	 * The base `DBDriverProtocol` expects `listDir` to return an array of string URIs.
	 * We therefore return just the absolute keys that start with the given `uri`.
	 *
	 * @param {string} uri
	 * @returns {Promise<string[]>}
	 */
	async listDir(uri) {
		const store = this._getStore()
		const request = store.openCursor()
		const entries = /** @type {string[]} */ ([])

		return new Promise((resolve, reject) => {
			request.onerror = () => reject(new Error(`Failed to list ${uri}`))
			request.onsuccess = () => {
				const cursor = request.result
				if (!cursor) {
					resolve(entries)
					return
				}
				const key = String(cursor.key)
				if (key.startsWith(uri)) {
					entries.push(key) // return the full key (URI)
				}
				cursor.continue()
			}
		})
	}
}
