import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch } from '@nan0web/http-node'
import DBBrowser from '../../../../src/DBBrowser.js'

/**
 * Release v1.1.0 — UDA 2.0 Integration Contract Tests
 *
 * These tests verify the acceptance criteria for the v1.1.0 release.
 * Each test maps to a specific acceptance criterion in task.md.
 */

describe('v1.1.0 — UDA 2.0 Integration', () => {
	/** @type {DBBrowser} */
	let db

	before(() => {
		const host = 'https://api.example.com'
		const root = '/data/'
		const mocks = [
			['GET ' + host + root + 'users.json', [200, [{ id: 1, name: 'Alice' }]]],
			['GET ' + host + root + 'missing.json', [404, 'Not Found']],
			['POST ' + host + root + 'doc.json', [201, { success: true }]],
			['DELETE ' + host + root + 'doc.json', [200, { ok: true }]],
			['GET ' + host + root + 'index.txt', 'users.json 1 1'],
		]

		db = new DBBrowser({
			host,
			root,
			fetchFn: mockFetch(mocks),
		})
	})

	// AC: _fetchPrimary() повертає undefined при 404
	it('_fetchPrimary returns undefined when document is not found', async () => {
		const result = await db._fetchPrimary('missing.json')
		assert.equal(result, undefined)
	})

	// AC: _fetchPrimary() повертає дані при 200
	it('_fetchPrimary returns data on success', async () => {
		const result = await db._fetchPrimary('users.json')
		assert.ok(Array.isArray(result))
		assert.equal(result[0].name, 'Alice')
	})

	// AC: saveDocument() емітить change event з type 'save'
	it('saveDocument emits change event with type save', async () => {
		const events = []
		db.on('change', (e) => events.push(e))
		await db.saveDocument('doc.json', { test: true })
		const saveEvent = events.find((e) => e.type === 'save')
		assert.ok(saveEvent, 'Expected a save event')
		assert.ok(saveEvent.uri.includes('doc.json'))
	})

	// AC: dropDocument() емітить change event з type 'drop'
	it('dropDocument emits change event with type drop', async () => {
		const events = []
		db.on('change', (e) => events.push(e))
		await db.dropDocument('doc.json')
		const dropEvent = events.find((e) => e.type === 'drop')
		assert.ok(dropEvent, 'Expected a drop event')
		assert.ok(dropEvent.uri.includes('doc.json'))
	})

	// AC: attach() + fetch() знаходить документ у fallback
	it('fallback chain finds document in attached DB', async () => {
		const host = 'https://primary.example.com'
		const fallbackHost = 'https://fallback.example.com'
		const root = '/'

		const primaryDb = new DBBrowser({
			host,
			root,
			fetchFn: mockFetch([['GET ' + host + root + 'config.json', [404, 'Not Found']]]),
		})

		const fallbackDb = new DBBrowser({
			host: fallbackHost,
			root,
			fetchFn: mockFetch([
				['GET ' + fallbackHost + root + 'config.json', [200, { theme: 'dark' }]],
			]),
		})

		primaryDb.attach(fallbackDb)
		const result = await primaryDb.fetch('config.json')
		assert.deepStrictEqual(result, { theme: 'dark' })
	})

	// AC: loadDocument() парсить text (не лише JSON)
	it('loadDocument handles text content (DirectoryIndex)', async () => {
		const result = await db.loadDocument('index.txt')
		assert.ok(typeof result === 'string', 'Expected string for .txt content')
		assert.ok(result.includes('users.json'))
	})

	// AC: README.md містить UDA 2.0 приклади
	it('README.md documents fallback chain and change events', async () => {
		const fs = await import('node:fs/promises')
		const readme = await fs.readFile(new URL('../../../../README.md', import.meta.url), 'utf-8')
		assert.ok(readme.includes('Fallback Chain'), 'README should document Fallback Chain')
		assert.ok(readme.includes('Change Events'), 'README should document Change Events')
		assert.ok(readme.includes('attach('), 'README should show attach() usage')
		assert.ok(readme.includes("on('change'"), 'README should show on(change) usage')
	})

	// AC: docs/uk/README.md оновлено
	it('Ukrainian README exists and documents UDA 2.0', async () => {
		const fs = await import('node:fs/promises')
		const readme = await fs.readFile(
			new URL('../../../../docs/uk/README.md', import.meta.url),
			'utf-8',
		)
		assert.ok(readme.includes('Ланцюг резерву'), 'UA README should document Fallback Chain')
		assert.ok(readme.includes('Події зміни'), 'UA README should document Change Events')
		assert.ok(readme.includes('v1.1.0'), 'UA README should mention v1.1.0')
	})

	// AC: package.json version = 1.1.0
	it('package version is 1.1.0', async () => {
		const fs = await import('node:fs/promises')
		const pkg = JSON.parse(
			await fs.readFile(new URL('../../../../package.json', import.meta.url), 'utf-8'),
		)
		assert.equal(pkg.version, '1.1.0')
	})
})
