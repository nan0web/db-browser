#!/usr/bin/env node

import Logger from '@nan0web/log'
import { pause } from '@nan0web/ui-cli'
import { fetch } from '@nan0web/http-node'
import DBBrowser from '../src/DBBrowser.js'
import startServer from '../src/test/RealServer.js'

/**
 * Runs a demo of DBBrowser against an in‑memory HTTP server.
 *
 * All operations are wrapped in try/catch – failures are reported
 * but do not abort the demo, so the script always reaches the end.
 *
 * @todo fix the errors during the presentation
 *
 * @param {Logger} console
 */
export async function runDBBrowserDemo(console) {
	// ------------------- 1. Prepare demo data -------------------
	const demoFiles = {
		// Root documents
		'users.json': [
			{ id: 1, name: 'Alice', email: 'alice@example.com' },
			{ id: 2, name: 'Bob', email: 'bob@example.com' },
		],
		'posts.json': [
			{ id: 1, title: 'Hello Universe', authorId: 1 },
			{ id: 2, title: 'Exploring Space', authorId: 2 },
		],
		'index.json': { version: '1.0.0', description: 'Demo Index' },

		// Directory index used by DBBrowser.readDir()
		'index.txtl': 'users.json 1 1\nposts.json 1 1\nindex.json 3 3',
	}

	// Data for Fallback DB
	const fallbackFiles = {
		'shared-config.json': { theme: 'dark', language: 'uk' },
	}

	// ------------------- 2. Start temporary HTTP servers ------------
	const { server, port } = await startServer(demoFiles)
	const { server: fallbackServer, port: fallbackPort } = await startServer(fallbackFiles)

	try {
		// ------------------- 3. Initialise DBBrowsers ---------------
		const db = new DBBrowser({
			host: `http://localhost:${port}`,
			root: '/',
			timeout: 8_000,
			fetchFn: fetch,
			console: console,
		})

		const fallbackDb = new DBBrowser({
			host: `http://localhost:${fallbackPort}`,
			root: '/',
			timeout: 8_000,
			fetchFn: fetch,
			console: console,
		})

		// UDA 2.0: Attach fallback DB
		db.attach(fallbackDb)

		await db.connect()
		await fallbackDb.connect()

		// console.clear()
		console.success('DBBrowser Demo (UDA 2.0 Enhanced)')
		console.info('Demonstrating browser database operations with live server data')

		// UDA 2.0: Setup change event logging
		db.on('change', (event) => {
			console.info(
				Logger.style(`\n🔔 EVENT: Document "${event.uri}" changed (type: ${event.type})`, {
					color: 'magenta',
				}),
			)
			if (event.data) {
				console.debug('Payload:', JSON.stringify(event.data))
			}
		})

		// ------------------- 4. Demo actions -----------------------

		// ---- UDA 2.0: Fallback Chain ------------------------------------
		console.info('\n🔗 UDA 2.0: Testing Fallback Chain:')
		console.info('Fetching "shared-config.json" (missing on primary, present on fallback)...')
		try {
			const config = await db.fetch('shared-config.json')
			console.success('Successfully fetched from fallback DB:')
			console.info(JSON.stringify(config, null, 2))
		} catch (e) {
			console.error('Fallback failed:', e.message)
		}
		await pause(1000)

		// ---- Fetch users ------------------------------------------------
		console.info('\n📄 Fetching users document:')
		try {
			const users = await db.fetch('users.json')
			console.info(JSON.stringify(users, null, 2))
		} catch (e) {
			console.error('Failed to fetch users:', e.message)
		}
		await pause(500)

		// ---- Search for JSON documents ---------------------------------
		console.info('\n🔍 Searching for documents:')
		try {
			const results = []
			for await (const uri of db.find('*.json')) {
				results.push(uri)
			}
			console.info('Found JSON files:', results.join(', '))
		} catch (e) {
			console.error('Search failed:', e.message)
		}
		await pause(500)

		// ---- Read directory --------------------------------------------
		console.info('\n📂 Reading directory:')
		try {
			const entries = []
			for await (const entry of db.readDir('.')) {
				entries.push(entry.name)
			}
			console.info('Directory entries:', entries.join(', '))
		} catch (e) {
			console.error('Directory read failed:', e.message)
		}
		await pause(500)

		// ---- UDA 2.0: Save & Event -------------------------------------
		console.info('\n📄 Saving new document (should trigger change event):')
		try {
			const result = await db.saveDocument('new-file.json', { test: 'value' })
			console.info('Save result:', JSON.stringify(result, null, 2))
		} catch (e) {
			console.error('Save failed:', e.message)
		}
		await pause(1000)

		// ---- UDA 2.0: Drop & Event -------------------------------------
		console.info('\n📄 Dropping document (should trigger change event):')
		try {
			const result = await db.dropDocument('new-file.json')
			console.info('Drop result:', result)
		} catch (e) {
			console.error('Failed to drop document:', e.message)
		}
		await pause(1000)

		console.success('\nDBBrowser demo completed! 🌐')
	} finally {
		// ------------------- 5. Clean up ---------------------------
		server.close(() => console.info('Primary Demo HTTP server stopped'))
		fallbackServer.close(() => console.info('Fallback Demo HTTP server stopped'))
	}
}
