import { describe, it, after, before } from 'node:test'
import assert from 'node:assert'
import startServer from './RealServer.js'

describe('RealServer', async () => {
	let server, port, baseUrl
	const files = {
		'data.json': { hello: 'world' },
		'text.txt': 'plain text',
	}
	before(async () => {
		const app = await startServer(files, { port: 0 })
		server = app.server
		port = app.port
		baseUrl = app.baseUrl
	})

	it('should listen on a dynamically allocated port', () => {
		assert.ok(port > 0, `Expected port > 0, got ${port}`)
		assert.ok(baseUrl.includes(`:${port}`), 'Base URL should contain the actual port')
	})

	it('should serve JSON content correctly', async () => {
		const res = await fetch(`${baseUrl}/data.json`)
		assert.strictEqual(res.status, 200, 'Expected status 200 for existing JSON file')
		const json = await res.json()
		assert.deepStrictEqual(json, files['data.json'])
	})

	it('should serve plain text correctly', async () => {
		const res = await fetch(`${baseUrl}/text.txt`)
		assert.strictEqual(res.status, 200, 'Expected status 200 for existing text file')
		const text = await res.text()
		assert.strictEqual(text, files['text.txt'])
	})

	it('should respond 404 for unknown paths', async () => {
		const res = await fetch(`${baseUrl}/unknown.txt`)
		assert.strictEqual(res.status, 404, 'Expected status 404 for unknown path')
	})

	// Cleanup after all tests
	after(async () => {
		await server.close()
	})
})
