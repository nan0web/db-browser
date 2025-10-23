/**
 * Prepare and create test db browser
 * @param {object} [opts]
 * @param {Array} [opts.fetchRules]
 * @param {Console} [opts.console]
 * @param {string} [opts.host]
 * @param {string} [opts.root]
 * @param {number} [opts.timeout]
 * @returns {MockDBBrowser}
 */
export function createDB(opts?: {
    fetchRules?: any[] | undefined;
    console?: Console | undefined;
    host?: string | undefined;
    root?: string | undefined;
    timeout?: number | undefined;
} | undefined): MockDBBrowser;
export class MockDBBrowser extends DBBrowser {
    /**
     * @param {object} [input]
     * @param {string} [input.host] - window.location.origin
     * @param {string} [input.indexFile='index.json']
     * @param {string} [input.localIndexFile='index.d.json']
     * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
     * @param {Function} [input.fetchFn=mockFetch([])] - Custom fetch function
     * @param {string} [input.root] - Base href (root) for the current DB
     * @param {Console | NoConsole} [input.console] - The console for messages
     * @param {Array} [input.fetchRules] - Rules for mockFetch
     */
    constructor(input?: {
        host?: string | undefined;
        indexFile?: string | undefined;
        localIndexFile?: string | undefined;
        timeout?: number | undefined;
        fetchFn?: Function | undefined;
        root?: string | undefined;
        console?: Console | NoConsole | undefined;
        fetchRules?: any[] | undefined;
    } | undefined);
    fetchRules: any[];
    /**
     * Creates mock fetch function from fetchRules
     * @returns {Function}
     */
    createFetchMock(): Function;
    /**
     * Override extract to preserve fetchRules for the subset
     * @param {string} uri
     * @returns {MockDBBrowser}
     */
    extract(uri: string): MockDBBrowser;
    /**
     * @override
     * @param {string} uri
     * @param {any} document
     * @returns {Promise<boolean>}
     */
    override saveDocument(uri: string, document: any): Promise<boolean>;
    saveIndex(dirUri: any, entries: any): Promise<void>;
}
import DBBrowser from '../DBBrowser.js';
import { NoConsole } from '@nan0web/log';
