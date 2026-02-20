import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import DBBrowser from '../../../../src/DBBrowser.js'

/**
 * @docs
 * #### Release v1.0.2 — HTTP 403 Retry (Server-Agnostic fetchRemote)
 *
 * Patch release: fetchRemote() now retries with `.json` extension
 * on HTTP 403, not just 404.
 *
 * Apache returns 403 Forbidden when the URI matches a directory name
 * (e.g., `/data/_` where `_/` directory exists alongside `_.json` file)
 * and `Options -Indexes` is set.
 *
 * This makes `db-browser` server-agnostic:
 * - Apache (403 on directory listing) ✅
 * - nginx (403 similarly) ✅
 * - Static hosting / dev servers (404) ✅
 *
 * Request: REQUESTS.md#1 from @industrialbank/bank
 */
describe('Release v1.0.2 — HTTP 403 Retry', () => {
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
		assert.ok(calls.includes('http://localhost/_'), 'First call should be without extension')
		assert.ok(calls.includes('http://localhost/_.json'), 'Retry call should have .json extension')
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
		assert.equal(response.status, 401, 'Should return 401 without retry')
		assert.equal(calls.length, 1, 'Should NOT retry on 401')
	})

	it('version in package.json is 1.0.2', async () => {
		const { readFile } = await import('node:fs/promises')
		const pkg = JSON.parse(
			await readFile(new URL('../../../../package.json', import.meta.url), 'utf-8'),
		)
		assert.equal(pkg.version, '1.0.2')
	})
})
