import { Directory } from "@nan0web/db"

export default class BrowserDirectory extends Directory {
	/**
	 * The default file name for directory settings.
	 * @type {string}
	 */
	static FILE = "_.json"

	/**
	 * The path prefix for global variables available to all nested documents.
	 * @type {string}
	 */
	static GLOBALS = "_/"

	/**
	 * The default index name for directories.
	 * @type {string}
	 */
	static INDEX = "index.json"

	/**
	 * Supported data file extensions for loading documents.
	 * @type {string[]}
	 */
	static DATA_EXTNAMES = [".json", ".jsonl", ".csv", ".yaml", ".yml", ".nano"]
}
