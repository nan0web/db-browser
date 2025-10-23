#!/usr/bin/env node

import process from "node:process"
import Logger from "@nan0web/log"
import { select } from "@nan0web/ui-cli"
import { runDBBrowserDemo } from "./db-browser-demo.js"

const console = new Logger({ level: "info" })

// Clear screen and show only logo initially
console.clear()
console.info(Logger.style(Logger.LOGO, { color: "cyan" }))

async function chooseDemo() {
	const demos = [
		{ name: "DBBrowser Demo", value: "dbbrowser" },
		{ name: "← Exit", value: "exit" }
	]

	const choice = await select({
		title: "Select demo to run:",
		prompt: "[me]: ",
		invalidPrompt: Logger.style("[me invalid]", { color: "red" }) + ": ",
		options: demos.map(d => d.name),
		console
	})

	return demos[choice.index].value
}

async function showMenu() {
	console.info("\n" + "=".repeat(50))
	console.info("Demo completed. Returning to menu...")
	console.info("=".repeat(50) + "\n")
}

async function main() {
	while (true) {
		try {
			const demoType = await chooseDemo()

			switch (demoType) {
				case "dbbrowser":
					await runDBBrowserDemo(console)
					break
				case "exit":
					process.exit(0)
					break
				default:
					console.warn("Unknown demo type selected")
			}

			await showMenu()
		} catch (error) {
			if (error.message && error.message.includes("cancel")) {
				console.warn("\nDemo selection cancelled. Returning to menu...")
				await showMenu()
			} else {
				throw error
			}
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch(err => {
		console.error(err)
		process.exit(1)
	})