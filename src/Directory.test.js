import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Directory from './Directory.js'

describe('Directory (base)', () => {
	it("should detect global paths", () => {
		assert.equal(Directory.isGlobal("/_/file"), true)
		assert.equal(Directory.isGlobal("/_/dir/file"), true)
		assert.equal(Directory.isGlobal("/dir/_/file"), true)
		assert.equal(Directory.isGlobal("dir/_/file"), true)
		assert.equal(Directory.isGlobal("/file"), false)
	})

	it("should detect directory paths", () => {
		assert.equal(Directory.isDirectory("/dir/"), true)
		assert.equal(Directory.isDirectory("dir/"), true)
		assert.equal(Directory.isDirectory("/file"), false)
		assert.equal(Directory.isDirectory("file"), false)
	})

	it("should find valid global name", () => {
		assert.equal(Directory.getGlobalName("/_/valid-name.json"), "valid-name")
		assert.equal(Directory.getGlobalName("/_/valid-name.yaml"), "valid-name")
		assert.equal(Directory.getGlobalName("/posts/_/valid-name"), "valid-name")
	})

	it("should return empty name when not global", () => {
		assert.equal(Directory.getGlobalName("/not-global.json"), "")
	})

	it("should return empty name for invalid global paths", () => {
		assert.equal(Directory.getGlobalName("/_/"), "")
		assert.equal(Directory.getGlobalName("/_/."), "")
		assert.equal(Directory.getGlobalName("/_/.json"), "")
	})
})
