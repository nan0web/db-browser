import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import DataDB from './DataDB.js'

const files = [
	["_.json", { $host: "nan0data.db", $baseHref: "/", $locale: "en" }],
	["_/langs.json", [{ code: "en", title: "English" }, { code: "uk", title: "Ukrainian" }]],
	["contacts.json", { tel: "+12345678", email: "email@email-example.com", address: { street: "1st", zip: 121212 } }],
	["uk/_.json", { $baseHref: "/uk/", $locale: "uk" }],
	["uk/index.json", { title: "Головна", content: ["ВітаннЯ!"] }],
	["en/index.json", { title: "Home", content: ["Welcome"] }],
	["en/promo.json", { slides: [{ title: "Call us", text: "+12345678" }] }],
	["en/about.json", { $extend: "en/index.json", title: { $ref: "contacts.json#address/zip" } }],
]

const expectations = [
	["_", files[0][1]],
	["_.json", files[0][1]],
	["_/langs", files[1][1]],
	["_/langs.json", files[1][1]],
	["contacts", { ...files[0][1], ...files[2][1] }],
	["contacts.json", files[2][1]],
	["uk/_", { ...files[0][1], ...files[3][1] }],
	["uk/_.json", files[3][1]],
	["uk/index", { ...files[0][1], ...files[3][1], ...files[4][1] }],
	["uk/index.json", files[4][1]],
	["en/index", { ...files[0][1], ...files[5][1] }],
	["en/index.json", files[5][1]],
	["en/promo", { ...files[0][1], ...files[6][1] }],
	["en/promo.json", files[6][1]],
	["en/about", { ...files[0][1], title: files[2][1].address.zip }],
	["en/about.json", { $extend: "en/index.json", title: { $ref: "contacts.json#address/zip" } }],
]

describe("DataDB", () => {
	/** @type {DataDB} */
	let db

	beforeEach(() => {
		db = new DataDB({
			cwd: "http://localhost",
			root: "/"
		})

		// Setup inheritance data for testing
		db.inheritance = {
			"/": files[0][1],
			"/uk/": files[3][1]
		}

		// Mock fetch function to return test data
		db.fetchFn = mock.fn(async (url) => {
			const path = url.replace("http://localhost/", "")
			const file = files.find(f => f[0] === path)

			if (file) {
				return {
					ok: true,
					json: async () => file[1]
				}
			}

			return {
				ok: false,
				status: 404,
				json: async () => ({ error: "Not found" })
			}
		})
	})

	describe("fetchMerged", () => {
		for (const [uri, exp] of expectations) {
			it.todo("should fetch merged data for " + uri, async () => {
				const result = await db.fetchMerged(uri)
				assert.deepEqual(result, exp)
			})
		}
	})

	describe("constructor", () => {
		it("should initialize with empty inheritance", () => {
			const newDb = new DataDB()
			assert.deepEqual(newDb.inheritance, {})
		})
	})
})
