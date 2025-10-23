#!/usr/bin/env node

import Logger from "@nan0web/log"
import { pause } from "@nan0web/ui-cli"
import { fetch } from "@nan0web/http-node"
import DBBrowser from "../src/DBBrowser.js"
import startServer from "../src/test/RealServer.js"

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
		"users.json": [
			{ id: 1, name: "Alice", email: "alice@example.com" },
			{ id: 2, name: "Bob", email: "bob@example.com" }
		],
		"posts.json": [
			{ id: 1, title: "Hello Universe", authorId: 1 },
			{ id: 2, title: "Exploring Space", authorId: 2 }
		],
		"index.json": { version: "1.0.0", description: "Demo Index" },

		// Directory index used by DBBrowser.readDir()
		"index.txtl": "users.json 1 1\nposts.json 1 1\nindex.json 3 3"
	}

	// ------------------- 2. Start temporary HTTP server ------------
	const { server, port } = await startServer(demoFiles)

	try {
		// ------------------- 3. Initialise DBBrowser ---------------
		const db = new DBBrowser({
			host: `http://localhost:${port}`,
			root: "/",
			timeout: 8_000,
			fetchFn: fetch, // native fetch works with the real server
			console: console,
		})

		await db.connect()

		console.clear()
		console.success("DBBrowser Demo")
		console.info("Demonstrating browser database operations with live server data")

		// ------------------- 4. Demo actions -----------------------
		// ---- Fetch users ------------------------------------------------
		console.info("\n📄 Fetching users document:")
		try {
			const users = await db.fetch("users.json")
			console.info(JSON.stringify(users, null, 2))
		} catch (e) {
			console.error("Failed to fetch users:", e.message)
		}
		await pause(500)

		// ---- Fetch posts ------------------------------------------------
		console.info("\n📄 Fetching posts document:")
		try {
			const posts = await db.fetch("posts.json")
			console.info(JSON.stringify(posts, null, 2))
		} catch (e) {
			console.error("Failed to fetch posts:", e.message)
		}
		await pause(500)

		// ---- Get globals (optional, ignore errors) --------------------
		console.info("\n⚙️  Getting globals from nested path:")
		try {
			const globals = await db.getGlobals("some/deep/path/file.txt")
			console.info(JSON.stringify(globals, null, 2))
		} catch (e) {
			console.warn("Globals not available – ignored:", e.message)
		}
		await pause(500)

		// ---- Search for JSON documents ---------------------------------
		console.info("\n🔍 Searching for documents:")
		try {
			const results = []
			for await (const uri of db.find("*.json")) {
				results.push(uri)
			}
			console.info("Found JSON files:", results.join(", "))
		} catch (e) {
			console.error("Search failed:", e.message)
		}
		await pause(500)

		// ---- Read directory --------------------------------------------
		console.info("\n📂 Reading directory:")
		try {
			const entries = []
			for await (const entry of db.readDir(".")) {
				entries.push(entry.name)
			}
			console.info("Directory entries:", entries.join(", "))
		} catch (e) {
			console.error("Directory read failed:", e.message)
		}
		await pause(500)

		// ---- Save a new document ---------------------------------------
		console.info("\n📄 Saving new document:")
		try {
			const result = await db.saveDocument("new-file.json", { test: "value" })
			console.info("Save result:", result)
		} catch (e) {
			console.error("Save failed:", e.message)
		}
		await pause(500)

		// ---- Write (update) an existing document -----------------------
		console.info("\n📄 Writing updated document:")
		try {
			const result = await db.writeDocument("users.json", [
				{ id: 1, name: "Alice Cooper", email: "alice@example.com" },
				{ id: 2, name: "Bob Marley", email: "bob@example.com" },
				{ id: 3, name: "Charlie Brown", email: "charlie@example.com" },
			])
			console.info("Write result:", result)
		} catch (e) {
			console.error("Failed to write document:", e.message)
		}
		await pause(500)

		// ---- Delete the previously created document --------------------
		console.info("\n📄 Dropping document:")
		try {
			const result = await db.dropDocument("new-file.json")
			console.info("Drop result:", result)
		} catch (e) {
			console.error("Failed to drop document:", e.message)
		}
		await pause(500)

		// ---- Extract a DB subset ----------------------------------------
		console.info("\n📂 Extracting DB subset:")
		try {
			const subDB = db.extract("posts.json")
			console.info("Subset root:", subDB.root)
			console.info("Subset instanceof DBBrowser:", subDB instanceof DBBrowser)
		} catch (e) {
			console.error("Failed to extract subset:", e.message)
		}

		console.success("\nDBBrowser demo completed! 🌐")
	} finally {
		// ------------------- 5. Clean up ---------------------------
		server.close(() => {
			console.info("Demo HTTP server stopped")
		})
	}
}
