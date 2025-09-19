import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createDB } from './test/MockDBBrowser.js'

describe('DBBrowser path operations', () => {
	/** @type {DBBrowser} */
	let db

	beforeEach(() => {
		db = createDB({
			host: 'http://localhost',
			root: '/',
		})
	})

	describe('resolve', () => {
		it('should resolve URI components correctly', async () => {
			const resolved = await db.resolve('http://localhost', 'api', 'users.json')
			assert.equal(resolved, '/api/users.json')
		})

		it('should normalize duplicate slashes', async () => {
			const resolved = await db.resolve('http://localhost/', '/api/', 'users.json')
			assert.equal(resolved, '/api/users.json')
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

		it('should resolve empty URI to root', async () => {
			const resolved = await db.resolve('')
			assert.equal(resolved, '/')
		})

		it('should handle multiple relative paths', async () => {
			const resolvedDir = await db.resolve('http://localhost/api/', 'users/', 'profile.json')
			assert.equal(resolvedDir, '/api/users/profile.json')
			const resolvedNorm = await db.resolve('http://localhost/api', 'users', 'profile.json')
			assert.equal(resolvedNorm, '/api/users/profile.json')
		})

		it('should handle query parameters and fragments', async () => {
			const resolved = await db.resolve('http://localhost/api/', 'users.json?limit=10#section')
			assert.equal(resolved, '/api/users.json?limit=10#section')
		})

		it('should handle complex path resolution and returns without host', async () => {
			const resolved = await db.resolve('http://localhost/api/v1/', './users/../posts/', 'latest.json')
			assert.equal(resolved, '/api/v1/posts/latest.json')
		})
	})

	describe("resolveSync", () => {
		it("should properly resolve / + index.json", () => {
			assert.equal(db.resolveSync("/", "index.js"), "/index.js")
		})

		it("should properly resolve / + index.json and hash", () => {
			assert.equal(db.resolveSync("/", "index.js#ref"), "/index.js#ref")
		})

		it("should resolve empty string to root", () => {
			assert.equal(db.resolveSync(""), "/")
		})

		it("should handle query parameters and fragments", () => {
			assert.equal(db.resolveSync("users.json?limit=10#section"), "/users.json?limit=10#section")
		})
	})

	describe.skip("relative", () => {
		it("should compute relative path between same host URLs", () => {
			db.cwd = 'http://localhost'
			const from = "http://localhost/api/users/list.json"
			const to = "http://localhost/api/posts/recent.json"
			const result = db.relative(from, to)
			assert.equal(result, "../posts/recent.json")
		})

		it("should compute relative path with query parameters and hash", () => {
			db.cwd = 'http://localhost'
			const from = "http://localhost/api/users/"
			const to = "http://localhost/api/users/profile.json?tab=settings#info"
			const result = db.relative(from, to)
			assert.equal(result, "profile.json?tab=settings#info")
		})

		it("should return absolute path when hosts differ", () => {
			const from = "http://localhost/api/users/"
			const to = "https://example.com/api/posts/"
			const result = db.relative(from, to)
			assert.equal(result, "https://example.com/api/posts/")
		})

		it("should handle paths in same directory", () => {
			db.cwd = 'http://localhost'
			const from = "http://localhost/api/data.json"
			const to = "http://localhost/api/info.json"
			const result = db.relative(from, to)
			assert.equal(result, "info.json")
		})

		it("should handle identical paths", () => {
			const from = "http://localhost/api/data.json"
			const to = "http://localhost/api/data.json"
			const result = db.relative(from, to)
			assert.equal(result, ".")
		})

		it("should handle root paths", () => {
			db.cwd = 'http://localhost'
			const from = "http://localhost/"
			const to = "http://localhost/api/info.json"
			const result = db.relative(from, to)
			assert.equal(result, "api/info.json")
		})

		it("should handle sibling directory navigation", () => {
			db.cwd = 'http://localhost'
			const from = "http://localhost/api/users/list"
			const to = "http://localhost/api/posts/recent"
			const result = db.relative(from, to)
			assert.equal(result, "../posts/recent")
		})
	})
})
