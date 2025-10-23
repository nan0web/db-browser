/**
 * DBBrowser – minimal, test‑focused implementation.
 *
 * Core design:
 * • Direct `fetch` returns `json()` when possible, otherwise falls back to `text()`.
 * • `fetchRemote` removes host for `mockFetch`, handles retries.
 * • `statDocument` ignores any cache (super.statDocument) to ensure `isFile` is set.
 */
export default class DBBrowser extends DB {
    /** @type {Function | null} */
    static "__#4@#FetchFn": Function | null;
    /** @type {Function} */
    static get FetchFn(): Function;
    /**
     * Static from helper.
     * @param {any} input
     * @returns {DBBrowser}
     */
    static from(input: any): DBBrowser;
    /**
     * @param {object} [input]
     * @param {string} [input.host] - window.location.origin
     * @param {string} [input.indexFile='index.json']
     * @param {string} [input.localIndexFile='index.d.json']
     * @param {number} [input.timeout=6_000] - Request timeout in ms
     * @param {Function} [input.fetchFn=DBBrowser.FetchFn] - Custom fetch function
     * @param {string} [input.root] - Base href (root) for the current DB
     * @param {Console | NoConsole} [input.console] - Console for messages
     */
    constructor(input?: {
        host?: string | undefined;
        indexFile?: string | undefined;
        localIndexFile?: string | undefined;
        timeout?: number | undefined;
        fetchFn?: Function | undefined;
        root?: string | undefined;
        console?: Console | NoConsole | undefined;
    } | undefined);
    /** @type {string} */
    host: string;
    /** @type {number} */
    timeout: number;
    /** @type {Function} */
    fetchFn: Function;
    /**
     * Fetch document – returns parsed JSON when possible, otherwise raw text.
     * @param {string} uri
     * @returns {Promise<any>}
     */
    fetch(uri: string): Promise<any>;
    /**
     * Performs fetch with timeout and fallback.
     *
     * Adjusts URL for `mockFetch` which expects path‑only.
     *
     * @param {string} uri
     * @param {object} [requestInit={}]
     * @param {Set<string>} [visited=new Set()] recursion guard
     * @returns {Promise<Response>}
     */
    fetchRemote(uri: string, requestInit?: object, visited?: Set<string> | undefined): Promise<Response>;
    /**
     * Throws formatted HTTPError.
     * @param {Response} response
     * @param {string} message
     * @throws {HTTPError}
     */
    throwError(response: Response, message: string): Promise<void>;
    /**
     * Saves via POST.
     * @param {string} uri
     * @param {any} document
     * @returns {Promise<any>}
     */
    saveDocument(uri: string, document: any): Promise<any>;
    /**
     * Updates via PUT.
     * @param {string} uri
     * @param {any} document
     * @returns {Promise<any>}
     */
    writeDocument(uri: string, document: any): Promise<any>;
    /**
     * Creates DB subset.
     * @param {string} uri
     * @returns {DBBrowser}
     */
    extract(uri: string): DBBrowser;
}
import DB from "@nan0web/db";
import { NoConsole } from "@nan0web/log";
