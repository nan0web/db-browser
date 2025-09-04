import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch } from "@nan0web/test"
import "@nan0web/test/jsdom"
import { HTTPError } from '@nan0web/http'
import BrowserDB from './BrowserDB.js'

describe('BrowserDB', () => {
	/** @type {BrowserDB} */
	let db

	beforeEach(() => {
		db = new BrowserDB({
			cwd: "http://localhost",
			root: "/",
			timeout: 99,
		})
	})

	describe('constructor', () => {
		it('should initialize with default values', () => {
			const defaultDB = new BrowserDB()
			assert.equal(defaultDB.host, '')
			assert.equal(defaultDB.timeout, 6_000)
		})

		it('should initialize with custom values', () => {
			const customDB = new BrowserDB({
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

	describe('resolve', () => {
		it('should resolve URI components correctly', async () => {
			const resolved = await db.resolve('http://localhost', 'api', 'users.json')
			assert.equal(resolved, '/api/users.json')
		})

		it('should normalize duplicate slashes', async () => {
			const resolved = await db.resolve('http://localhost/', '/api/', '/users.json')
			assert.equal(resolved, '/users.json')
		})

		it('should return last URI if different hosts', async () => {
			const resolved = await db.resolve('http://localhost/api', 'https://example.com/users.json')
			assert.equal(resolved, 'https://example.com/users.json')
		})

		it('should handle relative paths with same host', async () => {
			const resolved = await db.resolve('http://localhost/api/', '../users.json')
			assert.equal(resolved, '/users.json')
		})

		it('should handle absolute paths with same host', async () => {
			const resolved = await db.resolve('http://localhost/api/', '/users.json')
			assert.equal(resolved, '/users.json')
		})

		it('should resolve single URI component', async () => {
			const resolved = await db.resolve('users.json')
			assert.equal(resolved, '/users.json')
		})

		it('should resolve empty URI to host + root', async () => {
			const resolved = await db.resolve('')
			assert.equal(resolved, '/')
		})

		it('should handle multiple relative paths', async () => {
			const resolved = await db.resolve('http://localhost/api', 'users', 'profile.json')
			assert.equal(resolved, '/api/users/profile.json')
		})

		it('should handle query parameters and fragments', async () => {
			const resolved = await db.resolve('http://localhost/api', 'users.json?limit=10#section')
			assert.equal(resolved, '/api/users.json?limit=10#section')
		})

		it('should handle complex path resolution and returns without host', async () => {
			const resolved = await db.resolve('http://localhost/api/v1/', './users/../posts/', 'latest.json')
			assert.equal(resolved, '/api/v1/posts/latest.json')
		})
	})

	describe("fetch", () => {
		it("should not go into infinite loop", async () => {
			const db = new BrowserDB({ cwd: "http://localhost", root: "/", timeout: 99 })
			db.fetchFn = mockFetch([
				["GET /_.json", { "nav": [{ href: "index.html", title: "Home" }] }],
				["GET /typography.json", { "$content": [{ h1: "Typography" }] }],
			])
			await db.connect()
			const result = await db.fetch("typography.json")
			assert.deepEqual(result, {
				nav: [{ href: "index.html", title: "Home" }],
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
		it('should load index file', async () => {
			db.fetchFn = mockFetch([
				["GET /index", { global: true }],
				["*", new Error("Not found")],
			])

			const response = await db.load()
			assert.equal(response.status, 200)
			const data = await response.json()
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
