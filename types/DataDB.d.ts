export default DataDB;
/**
 * DataDB extends BrowserDB to provide enhanced data management capabilities
 * by merging data from parent directories, global variables, references, and
 * extended documents using nano-db-fetch patterns.
 */
declare class DataDB extends BrowserDB {
    /**
     * @param {object} input
     * @param {string} [input.extension='.json']
     * @param {string} [input.indexFile='index.json']
     * @param {string} [input.localIndexFile='index.d.json']
     * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
     * @param {Function} [input.fetchFn] - Custom fetch function, @nan0web/http-node for node.js.
     */
    constructor(input?: {
        extension?: string | undefined;
        indexFile?: string | undefined;
        localIndexFile?: string | undefined;
        timeout?: number | undefined;
        fetchFn?: Function | undefined;
    });
    /**
     * @override
     * @param {string} uri
     * @param {object | FetchOptions} [opts]
     * @returns {Promise<any>}
     */
    override fetch(uri: string, opts?: object | FetchOptions): Promise<any>;
    /**
     * @override
     * @param {string} uri
     * @param {FetchOptions} [opts]
     * @returns {Promise<any>}
     */
    override fetchMerged(uri: string, opts?: any): Promise<any>;
    /**
     * @override
     * @param {object} data
     * @param {string} [basePath]
     * @returns {Promise<object>}
     */
    override resolveReferences(data: object, basePath?: string | undefined): Promise<object>;
}
import BrowserDB from './BrowserDB.js';
