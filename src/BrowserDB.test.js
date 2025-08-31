import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import "@nan0web/test/jsdom"
import { HTTPError } from '@nan0web/http'
import BrowserDB from './BrowserDB.js'
describe('BrowserDB', () => {
	/** @type {BrowserDB} */
	let db

	beforeEach(() => {
		db = new BrowserDB({ cwd: "http://localhost", root: "/" })
	})

	describe('constructor', () => {
		it('should initialize with default values', () => {
			const defaultDB = new BrowserDB()
			assert.equal(defaultDB.extension, '.json')
			assert.equal(defaultDB.indexFile, 'index.json')
			assert.equal(defaultDB.localIndexFile, 'index.d.json')
			assert.equal(defaultDB.timeout, 6_000)
		})

		it('should initialize with custom values', () => {
			const customDB = new BrowserDB({
				extension: '.nano',
				indexFile: 'data.json',
				localIndexFile: 'local.json',
				timeout: 10_000
			})
			assert.equal(customDB.extension, '.nano')
			assert.equal(customDB.indexFile, 'data.json')
			assert.equal(customDB.localIndexFile, 'local.json')
			assert.equal(customDB.timeout, 10_000)
		})
	})

	describe('ensureAccess', () => {
		it('should validate access level', async () => {
			await assert.rejects(
				async () => await db.ensureAccess('public/data.json', 'invalid'),
				TypeError
			)

			assert.ok(await db.ensureAccess('public/data.json', 'r'))
			assert.ok(await db.ensureAccess('public/data.json', 'w'))
			assert.ok(await db.ensureAccess('public/data.json', 'd'))
		})
	})

	describe('resolve', () => {
		it('should resolve URI components correctly', async () => {
			const resolved = await db.resolve('http://localhost', 'api', 'users.json')
			assert.equal(resolved, 'http://localhost/api/users.json')
		})

		it('should normalize duplicate slashes', async () => {
			const resolved = await db.resolve('http://localhost/', '/api/', '/users.json')
			assert.equal(resolved, 'http://localhost/api/users.json')
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
				text: async () => JSON.stringify({ content: 'test' })
			}

			db.fetchFn = mock.fn(async () => mockResponse)

			const result = await db.fetchRemote('test.json')
			assert.equal(result.ok, true)
			assert.equal(result.status, 200)
			assert.deepEqual(await result.json(), { content: 'test' })
		})

		it('should throw HTTPError on timeout', async () => {
			db.fetchFn = mock.fn(async () => {
				return new Promise((resolve) => {
					setTimeout(() => resolve({ ok: true }), 10_000)
				})
			})
			db.timeout = 100

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
		it('should load local index when available', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				if (url === 'http://localhost/index.d.json') {
					return {
						ok: true,
						json: async () => ({ local: true })
					}
				}
				return { ok: false, status: 404, json: async () => ({}) }
			})

			const result = await db.load()
			assert.deepEqual(result, { local: true })
		})

		it('should fallback to global index when local index fails', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				if (url === 'http://localhost/index.d.json') {
					return { ok: false, status: 404, json: async () => ({}) }
				}
				if (url === 'http://localhost/index.json') {
					return {
						ok: true,
						json: async () => ({ global: true })
					}
				}
				return { ok: false, status: 404, json: async () => ({}) }
			})

			const result = await db.load()
			assert.deepEqual(result, { global: true })
		})

		it('should return empty object when both indexes fail', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				return { ok: false, status: 404, json: async () => ({}) }
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
					json: async () => ({ error: 'Not found' })
				}
			})

			const result = await db.loadDocument('missing.json', { default: true })
			assert.deepEqual(result, { default: true })
		})
	})

	describe('saveDocument', () => {
		it('should save document with POST request', async () => {
			db.fetchFn = mock.fn(async (url, init) => {
				assert.equal(init.method, 'POST')
				assert.equal(init.headers['Content-Type'], 'application/json')
				assert.deepEqual(JSON.parse(init.body), { test: 'data' })
				return {
					ok: true,
					json: async () => ({ saved: true })
				}
			})

			const result = await db.saveDocument('test.json', { test: 'data' })
			assert.deepEqual(result, { saved: true })
		})

		it('should throw error on failed save', async () => {
			db.fetchFn = mock.fn(async (url, init) => {
				return {
					ok: false,
					status: 500,
					json: async () => ({ error: 'Server error' })
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
})
