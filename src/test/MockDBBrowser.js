import { mockFetch } from '@nan0web/test'
import '@nan0web/test/jsdom' // provides DOM environment for fetch
import DBBrowser from '../DBBrowser.js'
import { DirectoryIndex, DocumentStat } from '@nan0web/db'
import { NoConsole } from '@nan0web/log'

export class MockDBBrowser extends DBBrowser {
	/**
	 * @param {object} [input]
	 * @param {string} [input.host] - window.location.origin
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
	 * @param {Function} [input.fetchFn=mockFetch([])] - Custom fetch function
	 * @param {string} [input.root] - Base href (root) for the current DB
	 * @param {Console | NoConsole} [input.console] - The console for messages
	 * @param {Array} [input.fetchRules] - Rules for mockFetch
	 */
	constructor(input = {}) {
		super(input)
		this.fetchRules = input.fetchRules || []
	}

	/**
	 * Creates mock fetch function from fetchRules
	 * @returns {Function}
	 */
	createFetchMock() {
		const responses = []

		// Process GET rules to generate equivalent HEAD responses
		this.fetchRules.forEach(([method, body, options]) => {
			if (method.startsWith('GET ')) {
				const path = method.replace('GET ', '')
				const contentLength = body && (typeof body === 'string' || typeof body === 'object')
					? (typeof body === 'string' ? body.length : JSON.stringify(body).length)
					: 0

				responses.push([
					method,
					body,
					[
						['Access-Control-Allow-Origin', '*'],
						...(options?.headers || [])
					]
				])

				// Add HEAD response
				responses.push([
					`HEAD ${path}`,
					'',
					[
						['Access-Control-Allow-Origin', '*'],
						['Content-Length', contentLength],
						['Last-Modified', 'Wed, 21 Oct 2015 07:28:00 GMT'],
						...(options?.headers || [])
					]
				])
			}
			// Include other methods (POST, PUT, etc.)
			else {
				responses.push([method, body, options]);
			}
		})

		// Add wildcard catch-all handler into 404
		responses.push(['*', [404, { error: 'Not found' }]]);

		return mockFetch(/** @type {[string, any][]} */(responses))
	}

	/**
	 * Override extract to preserve fetchRules for the subset
	 * @param {string} uri
	 * @returns {MockDBBrowser}
	 */
	extract(uri) {
		// First, get the DB subset
		const db = super.extract(uri)

		// Filter fetchRules to only include those under the extracted URI
		let prefix = uri
		if (!prefix.endsWith('/')) prefix += '/'
		if (!prefix.startsWith("/")) prefix = "/" + prefix
		const filteredRules = this.fetchRules.filter(([method]) => {
			if (!method.startsWith('GET ')) return false
			const path = method.replace('GET ', '')
			return path.startsWith(prefix)
		})
		// .map(([method, body, options]) => {
		// 	// Rewrite rule paths to be relative to the new root
		// 	const path = method.replace('GET ', '')
		// 	const newPath = path.substring(prefix.length)
		// 	return ['GET /' + newPath.replace(/^\/+/, '/'), body, options]
		// })

		// Create new MockDBBrowser with filtered rules
		const mockDb = new MockDBBrowser({
			...this.options,
			host: this.host,
			root: db.root,
			timeout: this.timeout,
			console: this.console ?? new NoConsole(),
			fetchRules: filteredRules,
		})
		mockDb.fetchFn = mockDb.createFetchMock()
		return mockDb
	}

	/**
	 * Connect and ensure indexes are generated with proper encoding
	 */
	async connect() {
		// Explicitly set fetchFn for this instance
		this.fetchFn = this.createFetchMock()

		// Ensure host is properly set
		if (!this.host) {
			this.host = 'http://localhost'
		}

		// Set cwd based on host
		this.cwd = this.host

		// Set default root if missing
		if (!this.root || this.root === '.') {
			this.root = '/'
		}

		await super.connect()

		// Generate indexes with proper encoding format
		const gen = DirectoryIndex.generateAllIndexes(this, ".")
		for await (const [uri, index] of gen) {
			// Determine appropriate encoding format
			const isFullIndex = uri.endsWith(DirectoryIndex.FULL_INDEX)
			const targetFormat = isFullIndex
				? DirectoryIndex.ENTRIES_AS_ARRAY
				: DirectoryIndex.ENTRIES_AS_TEXT

			// Encode properly and save
			const encodedIndex = index.encode({ target: targetFormat })
			const abs = this.normalize(uri)
			this.data.set(abs, encodedIndex)
			this.meta.set(abs, new DocumentStat({
				isFile: true, mtimeMs: Date.now(), size: String(encodedIndex).length,
			}))
		}
	}

	/**
	 * @override
	 * @param {string} uri
	 * @param {any} document
	 * @returns {Promise<boolean>}
	 */
	async saveDocument(uri, document) {
		await this.ensureAccess(uri, 'w')
		const href = this.absolute(uri)
		uri = this.normalize(uri)
		this.data.set(uri, document)
		this.meta.set(uri, new DocumentStat({
			mtimeMs: Date.now(),
			isFile: true,
			size: ("string" === typeof document ? document : JSON.stringify(document)).length
		}))
		this.console.info("Saved document", { href, uri, document })
		return true
	}

	async saveIndex(dirUri, entries) {
		if (!entries) {
			// Add meta and data from this.fetchRules
			for (const [method, body] of this.fetchRules) {
				if (method.startsWith('GET ')) {
					const path = method.replace('GET ', '')
					const uri = this.normalize(path)

					if (!this.meta.has(uri)) {
						const size = typeof body === 'string'
							? body.length
							: JSON.stringify(body).length

						this.meta.set(uri, new DocumentStat({
							isFile: true,
							mtimeMs: Date.now(),
							size: size
						}))
					}

					if (!this.data.has(uri)) {
						this.data.set(uri, body)
					}
				}
			}
			const base = this.normalize(dirUri)
			entries = Array.from(this.meta.entries()).filter(
				([uri]) => uri.startsWith(base)
			)
		}
		return await super.saveIndex(dirUri, entries)
	}
}

/**
 * Prepare and create test db browser
 * @param {object} [opts]
 * @param {Array} [opts.fetchRules]
 * @param {Console} [opts.console]
 * @param {string} [opts.host]
 * @param {string} [opts.root]
 * @param {number} [opts.timeout]
 * @returns {MockDBBrowser}
 */
export function createDB(opts = {}) {
	const {
		fetchRules = [],
		console = new NoConsole(),
		root = "/",
		host = 'http://localhost',
		timeout = 99
	} = opts

	return new MockDBBrowser({ host, root, timeout, console, fetchRules })
}
