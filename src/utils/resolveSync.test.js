import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSync } from './resolveSync.js'

describe('resolveSync', () => {
	const context = {
		cwd: 'http://localhost',
		root: '/',
	}

	it("should properly resolve / + index.json", () => {
		assert.equal(resolveSync(context, "/", "index.js"), "/index.js")
	})

	it("should properly resolve / + index.json and hash", () => {
		assert.equal(resolveSync(context, "/", "index.js#ref"), "/index.js#ref")
	})

	it("should resolve empty string to root", () => {
		assert.equal(resolveSync(context, ""), "/")
	})

	it("should handle query parameters and fragments", () => {
		assert.equal(resolveSync(context, "users.json?limit=10#section"), "/users.json?limit=10#section")
	})

	it('should normalize duplicate slashes', async () => {
		const result = resolveSync(context, '/api/', '/users.json')
		assert.strictEqual(result, '/users.json')
	})

	it("should resolve with multiple arguments", () => {
		assert.equal(resolveSync(context, "/api", "users.json"), "/api/users.json")
	})

	it("should resolve paths correctly with non-root base", () => {
		const ctx = { cwd: 'http://localhost', root: '/app/' }
		assert.equal(resolveSync(ctx, "file.json"), "/app/file.json")
	})

	// Additional tests for root != /
	it("should resolve relative path with non-root base context", () => {
		const ctx = { cwd: 'http://localhost', root: '/admin/' }
		assert.equal(resolveSync(ctx, "users/list"), "/admin/users/list")
	})

	it("should resolve absolute path with non-root base context", () => {
		const ctx = { cwd: 'http://localhost', root: '/dashboard/' }
		assert.equal(resolveSync(ctx, "/api/data"), "/api/data")
	})

	it("should resolve multiple segments with non-root base context", () => {
		const ctx = { cwd: 'http://localhost', root: '/project/' }
		assert.equal(resolveSync(ctx, "src", "components", "Button.jsx"), "/project/src/components/Button.jsx")
	})

	it("should handle nested root path properly", () => {
		const ctx = { cwd: 'http://localhost', root: '/app/admin/' }
		assert.equal(resolveSync(ctx, "config.json"), "/app/admin/config.json")
	})

	// Edge cases
	it("should handle null and undefined arguments", () => {
		assert.equal(resolveSync(context, null, "test.js", undefined), "/test.js")
	})

	it("should handle remote URLs correctly", () => {
		assert.equal(resolveSync(context, "http://external.com/api"), "http://external.com/api")
	})

	it("should handle remote URLs with query parameters", () => {
		assert.equal(resolveSync(context, "https://api.example.com/data?format=json"), "https://api.example.com/data?format=json")
	})

	it("should return root when all arguments are empty or filtered out", () => {
		assert.equal(resolveSync(context, null, undefined, ""), "/")
	})

	it("should handle complex path with dots and parent references", () => {
		const ctx = { cwd: 'http://localhost', root: '/site/' }
		assert.equal(resolveSync(ctx, "pages/../images/logo.png"), "/site/images/logo.png")
	})

	it("should preserve query and hash in complex scenarios", () => {
		const ctx = { cwd: 'http://localhost', root: '/web/' }
		assert.equal(resolveSync(ctx, "api/users.json?limit=5&page=2#results"), "/web/api/users.json?limit=5&page=2#results")
	})

	it("should handle root context ending without slash", () => {
		const ctx = { cwd: 'http://localhost', root: '/noslash' }
		assert.equal(resolveSync(ctx, "file.txt"), "/noslash/file.txt")
	})

	it("should handle deeply nested paths", () => {
		const ctx = { cwd: 'http://localhost', root: '/deep/nested/path/' }
		assert.equal(resolveSync(ctx, "a", "b", "c", "d.js"), "/deep/nested/path/a/b/c/d.js")
	})

	it('should resolve URI components correctly', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost', 'api', 'users.json')
		assert.strictEqual(result, '/api/users.json')
	})

	it('should normalize duplicate slashes', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost/', '/api/', 'users.json')
		assert.strictEqual(result, '/api/users.json')
	})

	it('should return last URI if different hosts', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost/api', 'https://example.com/users.json')
		assert.strictEqual(result, 'https://example.com/users.json')
	})

	it('should handle relative paths with same host', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost/api/', '../users.json')
		assert.strictEqual(result, '/users.json')
	})

	it('should handle absolute paths with same host', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost/api/', '/users.json')
		assert.strictEqual(result, '/users.json')
	})

	it('should resolve single URI component', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'users.json')
		assert.strictEqual(result, '/users.json')
	})

	it('should resolve empty URI to root', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, '')
		assert.strictEqual(result, '/')
	})

	it('should handle multiple relative paths', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const resolvedDir = resolveSync(ctx, 'http://localhost/api/', 'users/', 'profile.json')
		assert.strictEqual(resolvedDir, '/api/users/profile.json')

		const resolvedNorm = resolveSync(ctx, 'http://localhost/api', 'users', 'profile.json')
		assert.strictEqual(resolvedNorm, '/api/users/profile.json')
	})

	it('should handle query parameters and fragments', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost/api/', 'users.json?limit=10#section')
		assert.strictEqual(result, '/api/users.json?limit=10#section')
	})

	it('should handle complex path resolution and returns without host', () => {
		const ctx = { cwd: 'http://localhost', root: '/' }
		const result = resolveSync(ctx, 'http://localhost/api/v1/', './users/../posts/', 'latest.json')
		assert.strictEqual(result, '/api/v1/posts/latest.json')
	})
})
