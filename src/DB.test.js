/**
 * Comprehensive test suite for the DBBrowser implementation.
 * All tests from the base DB (`@nan0web/db/src/DB/DB.test.js`) have been
 * migrated here and adapted to work with `mockFetch`.
 *
 * The `predefined` option has been fully replaced by `fetchRules` to ensure
 * all data loading goes through simulated network requests -- no in-memory
 * overrides. This provides more realistic end-to-end coverage.
 *
 * @group DBBrowser
 */

import { suite, describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import DB, { StreamEntry } from '@nan0web/db'
import { HTTPError } from '@nan0web/http'
import { mockFetch, fetch } from '@nan0web/http-node'
import { NoConsole } from '@nan0web/log'
import DBBrowser from './DBBrowser.js'
import startServer from "./test/RealServer.js"


// ---
// Begin test suite -- fully network-mocked, no predefined
suite('DBBrowser (DB tests -- network mocked)', () => {
	/** @type {DBBrowser} */
	let db

	beforeEach(async () => {
		db = new DBBrowser({
			host: 'https://localhost',
			fetchFn: mockFetch([])
		})
	})

	describe('constructor', () => {
		it('should create instance with default values', () => {
			const defaultDB = new DBBrowser()
			assert.equal(defaultDB.host, '')
			assert.equal(defaultDB.timeout, 6_000)
			assert.equal(defaultDB.root, '/')
			assert.equal(defaultDB.cwd, '.') // from super
		})

		it('should create instance with custom values', () => {
			const custom = new DBBrowser({
				host: 'https://example.com',
				timeout: 10_000,
				root: '/app/'
			})
			assert.equal(custom.host, 'https://example.com')
			assert.equal(custom.timeout, 10_000)
			assert.equal(custom.root, '/app/')
			assert.equal(custom.cwd, 'https://example.com')
		})
	})

	describe('attach and detach', () => {
		let db1, db2

		beforeEach(async () => {
			db1 = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
			db2 = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
			db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
		})

		it('should attach a DB instance', () => {
			db.attach(db1)
			assert.strictEqual(db.dbs.length, 1)
			assert.strictEqual(db.dbs[0], db1)
		})

		it('should throw when attaching non‑DB', () => {
			assert.throws(() => db.attach({}), TypeError)
		})

		it('should detach an existing DB', () => {
			db.attach(db1)
			const result = db.detach(db1)
			assert.deepStrictEqual(result, [db1])
			assert.strictEqual(db.dbs.length, 0)
		})

		it('should return false when detaching missing DB', () => {
			const result = db.detach(db1)
			assert.strictEqual(result, false)
			assert.strictEqual(db.dbs.length, 0)
		})

		it('should detach one of many', () => {
			db.attach(db1)
			db.attach(db2)
			const result = db.detach(db1)
			assert.deepStrictEqual(result, [db1])
			assert.strictEqual(db.dbs.length, 1)
			assert.strictEqual(db.dbs[0], db2)
		})
	})

	describe.skip('extract', () => {
		it('should create a DB subset by loading remote data', async () => {
			// 0️⃣ => random free port
			const app = await startServer({
				'dir/file1.txt': "c1",
				'dir/file2.txt': "c2",
				'other.txt': "c3",
			})
			const db = new DBBrowser({ host: `https://localhost:${app.port}`, fetchFn: fetch })
			await db.connect()

			const sub = db.extract('dir/')
			const file1 = await sub.loadDocument('file1.txt', "")
			const file2 = await sub.fetch('file2.txt')

			assert.strictEqual(sub.root, 'dir/')
			assert.strictEqual(file1, 'c1')
			assert.deepStrictEqual(file2, 'c2')
			/**
			 * @todo when extracting a database in DBBrowser fetchFn must be reassigned somehow. if not easy just skip this test, it should work properly on server side, it might be changed with the server.
			 */
			const stat1 = await sub.stat('file1.txt')
			assert.ok(stat1.exists)
			const stat2 = await sub.stat('other.txt')
			assert.ok(stat2.exists === false)
		})
	})

	describe('extname', () => {
		it('should return extension with dot', () => {
			assert.strictEqual(db.extname('file.txt'), '.txt')
			assert.strictEqual(db.extname('archive.tar.gz'), '.gz')
		})

		it('should return empty string when no extension', () => {
			assert.strictEqual(db.extname('filename'), '')
		})

		it('should handle empty string gracefully', () => {
			assert.strictEqual(db.extname(''), '')
		})
	})

	describe.skip('relative', () => {
		it('should compute relative path between same host URLs', () => {
			const db = new DB()
			const from = '/api/users/list.json'
			const to = '/api/posts/recent.json'
			const result = db.relative(from, to)
			assert.strictEqual(result, '../posts/recent.json')
		})

		it('should include query & hash', () => {
			const from = '/api/users/'
			const to = '/api/users/profile.json?tab=settings#info'
			assert.strictEqual(db.relative(from, to), 'profile.json?tab=settings#info')
		})

		it('should return absolute URL when hosts differ', () => {
			const from = '/api/users/'
			const to = 'https://example.com/api/posts/'
			assert.strictEqual(db.relative(from, to), 'https://example.com/api/posts/')
		})

		it('should handle same directory', () => {
			const from = '/api/data.json'
			const to = '/api/info.json'
			assert.strictEqual(db.relative(from, to), 'info.json')
		})

		it('should return "." for identical files', () => {
			const from = '/api/data.json'
			const to = '/api/data.json'
			assert.strictEqual(db.relative(from, to), '.')
		})

		it('should handle root base', () => {
			const from = '/'
			const to = '/api/info.json'
			assert.strictEqual(db.relative(from, to), 'api/info.json')
		})

		it('should navigate sibling directories', () => {
			const db = new DB()
			const from = '/api/users/list'
			const to = '/api/posts/recent'
			assert.strictEqual(db.relative(from, to), '../posts/recent')
		})
	})

	describe('normalize', () => {
		it('should collapse duplicate slashes and resolve ..', () => {
			assert.strictEqual(db.normalize('/root', '/dir', 'file.txt'), 'root/dir/file.txt')
			assert.strictEqual(db.normalize('/root', '/dir', '..', 'file.txt'), 'root/file.txt')
		})
	})

	describe('resolveSync', () => {
		it('should resolve index path correctly', () => {
			assert.strictEqual(db.resolveSync('/', 'index.js'), '/index.js')
		})
	})

	describe('find', () => {
		it('should yield specific URI if present', async () => {
			const db = new DBBrowser({
				console: new NoConsole(),
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/test.txt', 'content'],
					['GET https://localhost/index.txt', "test.txt 1 1"]
				])
			})
			await db.connect()
			const results = []
			for await (const uri of db.find('/test.txt')) {
				results.push(uri)
			}
			assert.deepStrictEqual(results, ['/test.txt'])
		})
	})

	describe('requireConnected', () => {
		it('should call connect when not connected', async () => {
			const bdb = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
			bdb.connected = false
			await bdb.requireConnected()
			assert.ok(bdb.connected)
		})

		it('should error if connection fails', async () => {
			const bdb = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
			bdb.connect = async () => { bdb.connected = false }
			await assert.rejects(() => bdb.requireConnected(), /DB is not connected/)
		})
	})

	describe('get', () => {
		it('should load from network if not cached', async () => {
			const bdb = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([['GET https://localhost/cached.txt', 'cached data']])
			})
			await bdb.connect()
			const result = await bdb.get('cached.txt')
			assert.strictEqual(result, 'cached data')
		})
	})

	describe('set', () => {
		it('should store value and update meta', async () => {
			const bdb = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
			await bdb.set('new.txt', 'hello')
			assert.strictEqual(bdb.data.get('new.txt'), 'hello')
			const meta = bdb.meta.get('new.txt')
			assert.ok(meta)
			assert.ok(meta.mtimeMs > 0)
		})
	})

	describe('stat', () => {
		it('should fetch remote stat when missing in cache', async () => {
			const bdb = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/remote.txt', 'data'],
					['HEAD https://localhost/remote.txt', [200, { 'content-length': '4', 'last-modified': 'Fri, 27 Oct 2015 00:00:00 GMT' }]]
				])
			})
			await bdb.connect()
			const stat = await bdb.stat('remote.txt')
			assert.ok(stat.isFile)
			assert.strictEqual(stat.size, 4)
			assert.strictEqual(stat.mtime.toISOString(), "2015-10-27T00:00:00.000Z")
		})
	})

	describe('resolve', () => {
		// Тести resolve не викликають fetch, тому можна залишити як є
		it.todo('should resolve with host & path components', async () => {
			const result = await db.resolve('http://localhost', 'api', 'users.json')
			assert.strictEqual(result, '/api/users.json')
		})

		it.todo('should normalize duplicate slashes', async () => {
			const result = await db.resolve('http://localhost/', '/api/', '/users.json')
			assert.strictEqual(result, '/users.json')
		})

		it.todo('should return last URI if hosts differ', async () => {
			const result = await db.resolve('http://localhost/api', 'https://example.com/users.json')
			assert.strictEqual(result, 'https://example.com/users.json')
		})

		it.todo('should handle relative paths with same host', async () => {
			const result = db.resolve('http://localhost/api/', '../users.json')
			assert.strictEqual(result, '/users.json')
		})

		it('should resolve single component', async () => {
			const result = await db.resolve('users.json')
			assert.strictEqual(result, '/users.json')
		})

		it('should resolve empty URI to root', async () => {
			const result = await db.resolve('')
			assert.strictEqual(result, '/')
		})

		it.todo('should handle absolute path with same host', async () => {
			const result = await db.resolve('http://localhost/api/', '/users.json')
			assert.strictEqual(result, '/users.json')
		})

		it.todo('should resolve complex path with ./ and ../', async () => {
			const result = await db.resolve('http://localhost/api/v1/', './users/../posts/', 'latest.json')
			assert.strictEqual(result, '/api/v1/posts/latest.json')
		})
	})

	describe('fetchRemote', () => {
		it('should fetch document successfully', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([['GET https://localhost/doc.json', { content: 'test' }]])
			})
			await db.connect()
			const resp = await db.fetchRemote('doc.json')
			assert.ok(resp.ok)
			assert.deepStrictEqual(await resp.json(), { content: 'test' })
		})

		it('should retry extensions when content-type not recognised', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([['GET https://localhost/data.json', { hello: 'world' }]])
			})
			await db.connect()
			const resp = await db.fetchRemote('data')
			const json = await resp.json()
			assert.deepStrictEqual(json, { hello: 'world' })
		})

		it('should throw HTTPError on timeout', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: () => new Promise((_, reject) => setTimeout(() => reject(new HTTPError('timeout', 408)), 50))
			})
			db.timeout = 10
			await assert.rejects(
				() => db.fetchRemote('slow.json'),
				err => err instanceof HTTPError && err.status === 408
			)
		})

		it('should re‑throw unexpected errors', async () => {
			const err = new Error('network failure')
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: async () => { throw err }
			})
			await assert.rejects(() => db.fetchRemote('oops.json'), e => e === err)
		})
	})

	describe('loadDocument', () => {
		it('should load document successfully', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([['GET https://localhost/doc.json', { data: 123 }]])
			})
			await db.connect()
			const result = await db.loadDocument('doc.json')
			assert.deepStrictEqual(result, { data: 123 })
		})

		it('should return default when fetch fails', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: async () => { throw new Error('network error') }
			})
			await db.connect()
			const def = { fallback: true }
			const result = await db.loadDocument('missing.json', def)
			assert.deepStrictEqual(result, def)
		})
	})

	describe('saveDocument', () => {
		it('should POST document and return JSON response', async () => {
			let value
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					["POST https://localhost/save.json", (data) => {
						value = data
						return true
					}],
					["GET https://localhost", value],
				])
			})
			await db.connect()
			const result = await db.saveDocument('save.json', { foo: 'bar' })
			assert.deepStrictEqual(value.body, JSON.stringify({ foo: 'bar' }))
			assert.deepStrictEqual(result, true)
		})
	})

	describe('writeDocument', () => {
		it('should PUT document and return parsed response', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: async () => ({
					ok: true,
					json: async () => ({ written: true })
				})
			})
			const result = await db.writeDocument('file.json', { a: 1 })
			assert.deepStrictEqual(result, { written: true })
		})
	})

	describe('dropDocument', () => {
		it('should DELETE and return true on success', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: async () => ({ ok: true })
			})
			const result = await db.dropDocument('remove.json')
			assert.strictEqual(result, true)
		})
	})

	describe.skip('push', () => {
		it('should ensure write access for every stored document', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/known.txt', 'data'],
					['GET https://localhost/another.json', { x: 1 }]
				])
			})
			await db.connect()
			const accesses = []
			db.ensureAccess = async (uri, level) => {
				accesses.push({ uri, level })
				return true
			}
			await db.push()
			assert.ok(accesses.some(a => a.uri === 'known.txt' && a.level === 'w'))
			assert.ok(accesses.some(a => a.uri === 'another.json' && a.level === 'w'))
		})
	})

	describe('disconnect', () => {
		it('should set connected to false', async () => {
			db.connected = true
			await db.disconnect()
			assert.strictEqual(db.connected, false)
		})
	})

	describe('findStream', () => {
		it('should yield StreamEntry instances', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/file.txt', 'data'],
					['GET https://localhost/index.txt', 'file.txt 1 1'],
				])
			})
			await db.connect()
			const entries = []
			for await (const entry of db.findStream('.')) {
				entries.push(entry)
			}
			assert.ok(entries[0] instanceof StreamEntry)
		})
	})

	describe('from', () => {
		it('should return same instance if already DBBrowser', () => {
			const same = DBBrowser.from(db)
			assert.strictEqual(same, db)
		})

		it('should create new instance from plain object', () => {
			const obj = { root: '/test' }
			const newInst = DBBrowser.from(obj)
			assert.ok(newInst instanceof DBBrowser)
			assert.strictEqual(newInst.root, '/test')
		})
	})

	describe('getInheritance', () => {
		it('should merge globals from root, parent and current via HTTP', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/_.json', { global: 'root' }],
					['GET https://localhost/dir1/_.json', { a: 1 }],
					['GET https://localhost/dir1/dir2/_.json', { b: 2 }],
				])
			})
			await db.connect()
			const result = await db.getInheritance('/dir1/dir2/file.json')
			assert.deepStrictEqual(result, { global: 'root', a: 1, b: 2 })
		})
	})

	describe('getGlobals', () => {
		it('should collect globals from nearest _/ directories via HTTP', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/_/currencies.json', [200, ['BTC']]],
					['GET https://localhost/dir1/_/currencies.json', [200, ['BTC', 'UAH']]],
					['GET https://localhost/dir1/dir2/_/currencies.json', [200, ['USD']]],
					['GET https://localhost/index.txtl', [200, [
						"_/currencies.json 1 1",
						"dir1/_/currencies.json 1 1",
						"dir1/dir2/_/currencies.json 1 1",
					].join("\n")]],
				])
			})
			await db.connect()
			const r1 = await db.getGlobals('dir1/dir2/file.txt')
			const r2 = await db.getGlobals('dir1/file.txt')
			const r3 = await db.getGlobals('file.txt')
			assert.deepStrictEqual(r1, { currencies: ['USD'] })
			assert.deepStrictEqual(r2, { currencies: ['BTC', 'UAH'] })
			assert.deepStrictEqual(r3, { currencies: ['BTC'] })
		})
	})

	describe.skip('fetch', () => {
		it('should resolve simple fetch with inheritance', async () => {
			const db = new DBBrowser({
				console: new NoConsole(),
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/_.json', { g: 1 }],
					['GET https://localhost/doc.json', { a: 2 }],
					['GET https://localhost/index.txt', "_.json 1 1\ndoc.json 2 2"]
				])
			})
			await db.connect()
			const result = await db.fetch('doc.json')
			assert.deepStrictEqual(result, { g: 1, a: 2 })
		})

		it('should resolve reference chain', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/ref.json', { prop: { sub: 'value' } }],
					['GET https://localhost/data.json', { key: '$ref:ref.json#prop/sub' }],
				])
			})
			await db.connect()
			const result = await db.fetch('data.json')
			assert.deepStrictEqual(result, { key: 'value' })
		})

		it('should return default when document missing', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([])
			})
			const opts = new DB.FetchOptions({ defaultValue: { foo: 'bar' } })
			const result = await db.fetch('missing.json', opts)
			assert.deepStrictEqual(result, { foo: 'bar' })
		})
	})

	describe('resolveReferences', () => {
		it('should resolve simple $ref string', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/ref.json', { val: 42 }]
				])
			})
			await db.connect()
			const data = { key: '$ref:ref.json' }
			const result = await db.resolveReferences(data)
			assert.deepStrictEqual(result, { key: { val: 42 } })
		})

		it('should resolve fragment reference', async () => {
			const db = new DBBrowser({
				host: 'https://localhost',
				fetchFn: mockFetch([
					['GET https://localhost/ref.json', { obj: { inner: 'found' } }]
				])
			})
			await db.connect()
			const data = { k: '$ref:ref.json#obj/inner' }
			const result = await db.resolveReferences(data)
			assert.deepStrictEqual(result, { k: 'found' })
		})

		it('should keep original when reference missing', async () => {
			const db = new DBBrowser({
				host: 'https://localhost'
			})
			const data = { k: '$ref:missing.json' }
			const result = await db.resolveReferences(data)
			assert.deepStrictEqual(result, data)
		})
	})
})
