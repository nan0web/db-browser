import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch } from "@nan0web/test"
import "@nan0web/test/jsdom"
import { HTTPError } from '@nan0web/http'
import DBBrowser from './DBBrowser.js'
import { DirectoryIndex } from '@nan0web/db'
import { createDB } from './test/MockDBBrowser.js'

/**
 * Генерує індекс для директорії на основі зазначених файлів
 * @param {string} dir - Базова директорія
 * @param {Record<string, any>} files - Список файлів {path: content}
 * @returns {string[][]} Масив, що представляє індекс
 */
function createIndexEntries(dir, files) {
	const entries = []
	const dirPrefix = dir.endsWith('/') ? dir : dir + '/'

	for (const [path, content] of Object.entries(files)) {
		if (!path.startsWith(dirPrefix)) continue

		const relativePath = path.slice(dirPrefix.length)
		const isDir = relativePath.endsWith('/')
		const name = isDir ? relativePath.slice(0, -1) + '/' : relativePath

		entries.push([
			name,
			{
				mtimeMs: Date.now(),
				size: content ? JSON.stringify(content).length : 0,
				isFile: !isDir,
				isDirectory: isDir,
			}
		])
	}

	// Додаємо індекс-файл як директорію
	entries.push([DirectoryIndex.INDEX + '/', { isDirectory: true, mtimeMs: Date.now() }])

	return entries
}
/**
 * Створює тестову БД з автоматичними індексами
 * @param {Record<string, any>} files - Файли для тестової БД {path: content}
 * @returns {DBBrowser}
 */
function createDBWithIndices(files = {}) {
	const indexRules = []
	const seenDirs = new Set()

	for (const path of Object.keys(files)) {
		let currentDir = '/'
		seenDirs.add(currentDir)

		const parts = path.split('/').filter(Boolean)
		for (let i = 0; i < parts.length - 1; i++) {
			currentDir += parts[i] + '/'
			seenDirs.add(currentDir)
		}
	}

	for (const dir of seenDirs) {
		const indexEntries = createIndexEntries(dir, files)
		const index = new DirectoryIndex()
		const indexData = index.encode({ entries: indexEntries })

		indexRules.push([
			`GET ${dir}${DirectoryIndex.INDEX}`,
			indexData
		])

		indexRules.push([
			`GET ${dir}${DirectoryIndex.FULL_INDEX}`,
			JSON.stringify(indexEntries.map(([name, stat]) => ({
				name,
				mtimeMs: stat.mtimeMs,
				size: stat.size,
				type: stat.isDirectory ? 'D' : 'F'
			})))
		])
	}

	return new DBBrowser({
		cwd: "http://localhost",
		root: "/",
		timeout: 99,
		fetchFn: mockFetch([
			...Object.entries(files).map(([path, content]) => [`GET ${path}`, content]),
			...indexRules
		])
	})
}

describe('DBBrowser', () => {
	/** @type {DBBrowser} */
	let db

	beforeEach(() => {
		db = createDB({})
	})

	describe('constructor', () => {
		it('should initialize with default values', () => {
			const defaultDB = new DBBrowser()
			assert.equal(defaultDB.host, '')
			assert.equal(defaultDB.timeout, 6_000)
		})

		it('should initialize with custom values', () => {
			const customDB = new DBBrowser({
				host: 'https://example.com',
				timeout: 10_000
			})
			assert.equal(customDB.host, 'https://example.com')
			assert.equal(customDB.timeout, 10_000)
		})
	})

	describe('ensureAccess', () => {
		it('should validate access level', async () => {
			await assert.rejects(
				async () => await db.ensureAccess('public/data.json', 'invalid'),
				TypeError
			)

			await assert.doesNotReject(async () => await db.ensureAccess('public/data.json', 'r'))
			await assert.doesNotReject(async () => await db.ensureAccess('public/data.json', 'w'))
			await assert.doesNotReject(async () => await db.ensureAccess('public/data.json', 'd'))
		})
	})

	it("should detect global paths", () => {
		assert.equal(DBBrowser.Directory.isGlobal("/_/file"), true)
		assert.equal(DBBrowser.Directory.isGlobal("/_/dir/file"), true)
		assert.equal(DBBrowser.Directory.isGlobal("/dir/_/file"), true)
		assert.equal(DBBrowser.Directory.isGlobal("dir/_/file"), true)
		assert.equal(DBBrowser.Directory.isGlobal("/file"), false)
	})

	it("should detect directory paths", () => {
		assert.equal(DBBrowser.Directory.isDirectory("/dir/"), true)
		assert.equal(DBBrowser.Directory.isDirectory("dir/"), true)
		assert.equal(DBBrowser.Directory.isDirectory("/file"), false)
		assert.equal(DBBrowser.Directory.isDirectory("file"), false)
	})

	it("should find valid global name", () => {
		assert.equal(DBBrowser.Directory.getGlobalName("/_/valid-name.json"), "valid-name")
		assert.equal(DBBrowser.Directory.getGlobalName("/_/valid-name.yaml"), "valid-name")
		assert.equal(DBBrowser.Directory.getGlobalName("/posts/_/valid-name"), "valid-name")
	})

	it("should return empty name when not global", () => {
		assert.equal(DBBrowser.Directory.getGlobalName("/not-global.json"), "")
	})

	it("should return empty name for invalid global paths", () => {
		assert.equal(DBBrowser.Directory.getGlobalName("/_/"), "")
		assert.equal(DBBrowser.Directory.getGlobalName("/_/."), "")
		assert.equal(DBBrowser.Directory.getGlobalName("/_/.json"), "")
	})

	describe("fetch", () => {
		it("should not go into infinite loop", async () => {
			const db = new DBBrowser({ cwd: "http://localhost", root: "/", timeout: 99 })
			db.fetchFn = mockFetch([
				["GET /_.json", { "nav": [{ href: "index.html", title: "Home" }] }],
				["GET /typography.json", { "$content": [{ h1: "Typography" }] }],
			])
			await db.connect()
			const result = await db.fetch("typography.json")
			assert.deepEqual(result, {
				$content: [{ h1: "Typography" }]
			})
		})
	})

	describe('fetchRemote', () => {
		it('should fetch document successfully', async () => {
			const mockResponse = {
				url: 'http://localhost/test.json',
				headers: new Map(),
				ok: true,
				status: 200,
				statusText: 'OK',
				type: 'basic',
				redirected: false,
				json: async () => ({ content: 'test' })
			}

			db.fetchFn = mock.fn(async () => mockResponse)

			const result = await db.fetchRemote('test.json')
			assert.equal(result.ok, true)
			assert.equal(result.status, 200)
			assert.deepEqual(await result.json(), { content: 'test' })
		})

		it.skip('should throw HTTPError on timeout', async () => {
			const db = new DBBrowser({
				host: "http://localhost",
				fetchFn: async () => {
					return new Promise((resolve) => {
						setTimeout(() => resolve({ ok: true }), 10_000)
					})
				},
				timeout: 33
			})

			await assert.rejects(
				async () => await db.fetchRemote('test.json'),
				(err) => {
					assert.ok(err instanceof HTTPError)
					assert.equal(err.message, 'Request timeout')
					assert.equal(err.status, 408)
					return true
				}
			)
		})

		it('should throw original error when not timeout', async () => {
			const error = new Error('Network error')
			db.fetchFn = mock.fn(async () => {
				throw error
			})

			await assert.rejects(
				async () => await db.fetchRemote('test.json'),
				(err) => {
					assert.equal(err, error)
					return true
				}
			)
		})
	})

	describe('load', () => {
		it.skip('should load index file', async () => {
			const db = createDB({
				"/index.json": { global: true },
				"*": new Error("Not found")
			})

			const data = await db.load()
			assert.deepEqual(data, { global: true })
		})

		it('should return empty object when index fails', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				throw new Error('Failed to fetch')
			})

			const result = await db.load()
			assert.deepEqual(result, {})
		})
	})

	describe('loadDocument', () => {
		it('should load document successfully', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				return {
					ok: true,
					json: async () => ({ content: 'test' })
				}
			})

			const result = await db.loadDocument('test.json')
			assert.deepEqual(result, { content: 'test' })
		})

		it('should return defaultValue on failed request', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				return {
					ok: false,
					status: 404,
					json: async () => {
						throw new Error('Not found')
					}
				}
			})

			const result = await db.loadDocument('missing.json', { default: true })
			assert.deepEqual(result, { default: true })
		})
	})

	describe('saveDocument', () => {
		it('should imitate saving document with POST request in MockDBBrowser', async () => {
			const result = await db.saveDocument('test.json', { test: 'data' })
			assert.deepEqual(result, true)
		})

		it('should save document with POST request', async () => {
			const db = new DBBrowser({
				fetchFn: async (url, init) => {
					assert.equal(init.method, 'POST')
					assert.equal(init.headers['Content-Type'], 'application/json')
					assert.deepEqual(JSON.parse(init.body), { test: 'data' })
					return {
						ok: true,
						json: async () => ({ saved: true })
					}
				}
			})

			const result = await db.saveDocument('test.json', { test: 'data' })
			assert.deepEqual(result, { saved: true })
		})

		it('should throw error on failed save', async () => {
			const db = new DBBrowser({
				fetchFn: async (url, init) => {
					return {
						ok: false,
						status: 500,
						json: async () => ({ error: 'Server error' })
					}
				}
			})

			await assert.rejects(
				async () => await db.saveDocument('test.json', { test: 'data' }),
				HTTPError
			)
		})
	})

	describe('writeDocument', () => {
		it('should write document with PUT request', async () => {
			db.fetchFn = mock.fn(async (url, init) => {
				assert.equal(init.method, 'PUT')
				assert.equal(init.headers['Content-Type'], 'application/json')
				assert.deepEqual(JSON.parse(init.body), { test: 'data' })
				return {
					ok: true,
					json: async () => ({ written: true })
				}
			})

			const result = await db.writeDocument('test.json', { test: 'data' })
			assert.deepEqual(result, { written: true })
		})

		it('should throw error on failed write', async () => {
			db.fetchFn = mock.fn(async (url, init) => {
				return {
					ok: false,
					status: 500,
					json: async () => ({ error: 'Server error' })
				}
			})

			await assert.rejects(
				async () => await db.writeDocument('test.json', { test: 'data' }),
				HTTPError
			)
		})
	})

	describe('dropDocument', () => {
		it('should delete document with DELETE request', async () => {
			db.fetchFn = mock.fn(async (url, init) => {
				assert.equal(init.method, 'DELETE')
				return {
					ok: true,
					json: async () => ({})
				}
			})

			const result = await db.dropDocument('test.json')
			assert.equal(result, true)
		})

		it('should throw error on failed delete', async () => {
			db.fetchFn = mock.fn(async (url, init) => {
				return {
					ok: false,
					status: 500,
					json: async () => ({ error: 'Server error' })
				}
			})

			await assert.rejects(
				async () => await db.dropDocument('test.json'),
				HTTPError
			)
		})
	})

	describe("statDocument", () => {
		it("should load document without index", async () => {
			const db = new DBBrowser({ cwd: "http://localhost", root: "/", timeout: 99 })
			db.fetchFn = mockFetch([
				["HEAD /typography.json",
					{ "Content-Length": "123", "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT" }
				],
				["GET /typography.json", { "$content": [{ h1: "Typography" }] }],
			])
			const stat = await db.statDocument("typography.json")
			assert.ok(stat.isFile)
			assert.equal(stat.size, 123)
			assert.equal(stat.mtimeMs, 1_445_412_480_000) // 2015-10-21 07:28:00 UTC in milliseconds
		})

		it("should handle missing Last-Modified header", async () => {
			const db = new DBBrowser({ cwd: "http://localhost", root: "/", timeout: 99 })
			db.fetchFn = mockFetch([
				["HEAD /typography.json", { "Content-Length": "123" }],
				["GET /typography.json", { "$content": [{ h1: "Typography" }] }],
			])
			const stat = await db.statDocument("typography.json")
			assert.ok(stat.isFile)
			assert.equal(stat.size, 123)
			assert.equal(stat.mtimeMs, 0)
		})
	})
})
