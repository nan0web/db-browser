import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import DBBrowser from '../../../../../DBBrowser.js'

/**
 * Release v1.0.2 — HTTP 403 Retry (Regression)
 *
 * Migrated from releases/1/0/v1.0.2/task.spec.js
 *
 * Updated for v1.1.0 changes:
 * - fetchRemote now tries .json proactively (without extension → tries .json first)
 * - 401 still should NOT retry with extension, but proactive .json attempt adds a call
 * - Version check removed (no longer v1.0.2)
 */
describe('Release v1.0.2 — HTTP 403 Retry (Regression)', () => {
	it('fetchRemote retries with .json on HTTP 403 (Apache directory listing)', async () => {
		const calls = []
		const db = new DBBrowser({
			cwd: 'http://localhost',
			root: '/',
			timeout: 99,
			fetchFn: mock.fn(async (url) => {
				calls.push(url)
				if (url === 'http://localhost/_') {
					return {
						ok: false,
						status: 403,
						headers: new Map(),
						json: async () => ({ error: 'Forbidden' }),
						text: async () => 'Forbidden',
					}
				}
				if (url === 'http://localhost/_.json') {
					return {
						ok: true,
						status: 200,
						headers: new Map([['content-type', 'application/json']]),
						json: async () => ({ nav: [{ href: '/', title: 'Home' }] }),
					}
				}
				return { ok: false, status: 404, headers: new Map() }
			}),
		})

		const response = await db.fetchRemote('_')

		assert.equal(response.ok, true, 'Response should be OK after retry')
		assert.equal(response.status, 200)
		assert.deepEqual(await response.json(), { nav: [{ href: '/', title: 'Home' }] })
		// v1.1.0: proactive .json means _.json is tried first (or as retry)
		assert.ok(calls.includes('http://localhost/_.json'), 'Should have tried .json extension')
	})

	it('fetchRemote still retries on 404 (backward compatibility)', async () => {
		const db = new DBBrowser({
			cwd: 'http://localhost',
			root: '/',
			timeout: 99,
			fetchFn: mock.fn(async (url) => {
				if (url === 'http://localhost/data') {
					return { ok: false, status: 404, headers: new Map() }
				}
				if (url === 'http://localhost/data.json') {
					return {
						ok: true,
						status: 200,
						headers: new Map([['content-type', 'application/json']]),
						json: async () => ({ items: [] }),
					}
				}
				return { ok: false, status: 404, headers: new Map() }
			}),
		})

		const response = await db.fetchRemote('data')
		assert.equal(response.ok, true)
		assert.deepEqual(await response.json(), { items: [] })
	})

	it('fetchRemote does NOT retry on other 4xx errors (e.g., 401)', async () => {
		const calls = []
		const db = new DBBrowser({
			cwd: 'http://localhost',
			root: '/',
			timeout: 99,
			fetchFn: mock.fn(async (url) => {
				calls.push(url)
				return {
					ok: false,
					status: 401,
					headers: new Map(),
					json: async () => ({ error: 'Unauthorized' }),
				}
			}),
		})

		const response = await db.fetchRemote('secret')
		assert.equal(response.status, 401, 'Should return 401')
		// v1.1.0: proactive .json adds one extra call for extensionless URIs
		assert.ok(calls.length <= 2, 'Should not retry beyond proactive .json')
	})
})
