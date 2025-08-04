import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { HTTPError } from '@nanoweb/http'
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
			assert.equal(defaultDB.me, '')
			assert.equal(defaultDB.extension, '.json')
			assert.equal(defaultDB.indexFile, 'index.json')
			assert.equal(defaultDB.localIndexFile, 'index.d.json')
			assert.equal(defaultDB.timeout, 6_000)
		})

		it('should initialize with custom values', () => {
			const customDB = new BrowserDB({
				me: 'test-user',
				extension: '.nano',
				indexFile: 'data.json',
				localIndexFile: 'local.json',
				timeout: 10_000
			})
			assert.equal(customDB.me, 'test-user')
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

		it('should throw error on failed request', async () => {
			db.fetchFn = mock.fn(async (url, options) => {
				return {
					ok: false,
					status: 404,
					json: async () => ({ error: 'Not found' })
				}
			})

			await assert.rejects(
				async () => await db.loadDocument('missing.json'),
				HTTPError
			)
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
