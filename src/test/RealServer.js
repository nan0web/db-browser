import { createServer } from 'node:http'

/**
 * Simple HTTP server that serves JSON files from an in‑memory map.
 * Added support for POST, PUT, DELETE, and HEAD to facilitate the playground demo.
 *
 * @param {number} port - Desired listening port. `0` means assign a random free port.
 * @param {Record<string, unknown>} map - Path → data map.
 * @returns {import('node:http').Server} Configured HTTP server.
 */
function createJsonServer(port, map) {
	const server = createServer(async (req, res) => {
		// Resolve URL without relying on the actual listening port
		const url = new URL(req.url ?? '/', 'http://localhost')
		const pathname = url.pathname.replace(/^\/+/, '')

		// Helper to send JSON response
		const sendJSON = (code, payload) => {
			const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
			res.statusCode = code
			res.setHeader('Content-Type', 'application/json')
			res.end(body)
		}

		// Helper to send plain text response
		const sendText = (code, payload) => {
			res.statusCode = code
			res.setHeader('Content-Type', 'text/plain')
			res.end(payload)
		}

		if (req.method === 'GET') {
			if (Object.prototype.hasOwnProperty.call(map, pathname)) {
				const data = map[pathname]
				const isJSON = typeof data !== 'string' || pathname.endsWith('.json')
				const payload = isJSON ? JSON.stringify(data) : data
				res.setHeader('Content-Type', isJSON ? 'application/json' : 'text/plain')
				res.end(payload)
			} else {
				res.statusCode = 404
				res.end('Not found')
			}
			return
		}

		if (req.method === 'HEAD') {
			if (Object.prototype.hasOwnProperty.call(map, pathname)) {
				const data = map[pathname]
				const size = typeof data === 'string' ? Buffer.byteLength(data) : Buffer.byteLength(JSON.stringify(data))
				res.setHeader('Content-Length', size)
				res.setHeader('Last-Modified', new Date().toUTCString())
				res.statusCode = 200
				res.end()
			} else {
				res.statusCode = 404
				res.end()
			}
			return
		}

		if (req.method === 'POST' || req.method === 'PUT') {
			// Collect request body
			let body = ''
			for await (const chunk of req) {
				body += chunk
			}
			try {
				const parsed = JSON.parse(body)
				map[pathname] = parsed
			} catch {
				// store raw text if not JSON
				map[pathname] = body
			}
			sendJSON(200, { success: true })
			return
		}

		if (req.method === 'DELETE') {
			if (Object.prototype.hasOwnProperty.call(map, pathname)) {
				delete map[pathname]
				sendJSON(200, { success: true })
			} else {
				res.statusCode = 404
				res.end('Not found')
			}
			return
		}

		// Fallback for unsupported methods
		res.statusCode = 405
		res.end('Method Not Allowed')
	})
	return server
}

/**
 * Starts an in‑memory JSON server.
 *
 * @param {Record<string, unknown>} files - Map of path → data.
 * @param {{port?: number}} [options={port:0}] - Server options.
 * @returns {Promise<{server: import('node:http').Server, port: number, baseUrl: string}>}
 *          The running server, its actual port, and a ready‑to‑use base URL.
 */
export default async function startServer(files, options = { port: 0 }) {
	const server = createJsonServer(options.port ?? 0, files)
	await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(true)))
	const address = server.address()
	const port = typeof address === 'object' && address !== null && 'port' in address
		? /** @type {number} */ (address.port)
		: 0
	const baseUrl = `http://127.0.0.1:${port}`
	return { server, port, baseUrl }
}