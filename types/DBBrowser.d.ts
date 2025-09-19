export default DBBrowser;
/**
 * @goal
 * # Browser Database
 * Every source of data can be a part of your database.
 *
 * DBBrowser extends DB for browser usage for loading, saving, writing, and deleting
 * documents, so a standard GET, POST, PUT, DELETE operations.
 *
 * ## Requirements
 * - Every function and property must be jsdoc'ed with type (at least);
 * - Every public function must be tested;
 * - Every known vulnerability must be included in test;
 */
declare class DBBrowser extends DB {
    /** @type {Function | null} */
    static "__#3@#FetchFn": Function | null;
    /** @type {Function} */
    static get FetchFn(): Function;
    /**
     * @param {any} input
     * @returns {DBBrowser}
     */
    static from(input: any): DBBrowser;
    /**
     * @param {object} [input]
     * @param {string} [input.host] - window.location.origin
     * @param {string} [input.indexFile='index.json']
     * @param {string} [input.localIndexFile='index.d.json']
     * @param {number} [input.timeout=6_000] - Request timeout in milliseconds (default: 6000 ms)
     * @param {Function} [input.fetchFn=DBBrowser.FetchFn] - Custom fetch function
     * @param {string} [input.root] - Base href (root) for the current DB
     * @param {Console | NoConsole} [input.console] - The console for messages
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
    /**
     * The fetch function used by this specific instance.
     * @type {Function}
     */
    fetchFn: Function;
    /**
     * Fetches a document with authentication headers if available
     * @param {string} uri - The URI to fetch
     * @param {object} [requestInit={}] - Fetch request initialization options
     * @returns {Promise<Response>} Fetch response
     */
    fetchRemote(uri: string, requestInit?: object, visited?: Set<any>): Promise<Response>;
    /**
     * Load indexes from local or global index file
     * @returns {Promise<Record<string, any>>}
     */
    load(): Promise<Record<string, any>>;
    /**
     * Throw an HTTPError with appropriate message from response
     * @param {Response} response - Response object to extract error message from
     * @param {string} message - Default error message
     * @throws {HTTPError} Throws formatted error message
     */
    throwError(response: Response, message: string): Promise<void>;
    /**
     * @override
     * @param {string} uri
     * @param {any} document
     * @returns {Promise<any>}
     */
    override writeDocument(uri: string, document: any): Promise<any>;
    /**
     * Creates a new DB instance with a subset of the data and meta.
     * @param {string} uri The URI to extract from the current DB.
     * @returns {DBBrowser}
     */
    extract(uri: string): DBBrowser;
    /**
     * @override
     * @param {string} uri
     * @param {object} options
     * @yields {DocumentEntry}
     * @returns {AsyncGenerator<DocumentEntry, void, unknown>}
     */
    override readDir(uri: string, options?: object): AsyncGenerator<DocumentEntry, void, unknown>;
}
import DB from "@nan0web/db";
import { DocumentEntry } from "@nan0web/db";
import { NoConsole } from "@nan0web/log";
