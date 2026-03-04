export default class BrowserStore {
	static DB_NAME = 'nano_db_browser'
	static STORE_NAME = 'documents'
	static DB_VERSION = 1

	/** @type {Promise<IDBDatabase> | null} */
	#dbPromise = null

	init() {
		if (typeof window === 'undefined' || !window.indexedDB) {
			return Promise.reject(new Error('IndexedDB not available'))
		}
		if (this.#dbPromise) return this.#dbPromise

		this.#dbPromise = new Promise((resolve, reject) => {
			const request = window.indexedDB.open(BrowserStore.DB_NAME, BrowserStore.DB_VERSION)
			request.onupgradeneeded = () => {
				/** @type {IDBDatabase} */
				const db = request.result
				if (!db.objectStoreNames.contains(BrowserStore.STORE_NAME)) {
					db.createObjectStore(BrowserStore.STORE_NAME, { keyPath: 'uri' })
				}
			}
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => {
				this.#dbPromise = null
				reject(request.error)
			}
		})
		return this.#dbPromise
	}

	/**
	 * @param {string} uri
	 */
	async get(uri) {
		try {
			const db = await this.init()
			return new Promise((resolve, reject) => {
				const tx = db.transaction(BrowserStore.STORE_NAME, 'readonly')
				const store = tx.objectStore(BrowserStore.STORE_NAME)
				const request = store.get(uri)
				request.onsuccess = () => resolve(request.result || null)
				request.onerror = () => reject(request.error)
			})
		} catch {
			return null
		}
	}

	/**
	 * @param {string} uri
	 * @param {any} data
	 * @param {object} meta
	 */
	async put(uri, data, meta = {}) {
		try {
			const db = await this.init()
			return new Promise((resolve, reject) => {
				const tx = db.transaction(BrowserStore.STORE_NAME, 'readwrite')
				const store = tx.objectStore(BrowserStore.STORE_NAME)
				const request = store.put({ uri, data, ...meta })
				request.onsuccess = () => resolve(true)
				request.onerror = () => reject(request.error)
			})
		} catch {
			return false
		}
	}

	/**
	 * @param {string} uri
	 */
	async remove(uri) {
		try {
			const db = await this.init()
			return new Promise((resolve, reject) => {
				const tx = db.transaction(BrowserStore.STORE_NAME, 'readwrite')
				const store = tx.objectStore(BrowserStore.STORE_NAME)
				const request = store.delete(uri)
				request.onsuccess = () => resolve(true)
				request.onerror = () => reject(request.error)
			})
		} catch {
			return false
		}
	}

	/**
	 * @returns {Promise<any[]>}
	 */
	async getAllUnsynced() {
		try {
			const db = await this.init()
			return new Promise((resolve, reject) => {
				const tx = db.transaction(BrowserStore.STORE_NAME, 'readonly')
				const store = tx.objectStore(BrowserStore.STORE_NAME)
				const request = store.getAll()
				request.onsuccess = () =>
					resolve((request.result || []).filter((item) => item.unsynced === true))
				request.onerror = () => reject(request.error)
			})
		} catch {
			return []
		}
	}
}
