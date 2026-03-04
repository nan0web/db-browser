export default class BrowserStore {
    static DB_NAME: string;
    static STORE_NAME: string;
    static DB_VERSION: number;
    init(): Promise<IDBDatabase>;
    /**
     * @param {string} uri
     */
    get(uri: string): Promise<any>;
    /**
     * @param {string} uri
     * @param {any} data
     * @param {object} meta
     */
    put(uri: string, data: any, meta?: object): Promise<any>;
    /**
     * @param {string} uri
     */
    remove(uri: string): Promise<any>;
    /**
     * @returns {Promise<any[]>}
     */
    getAllUnsynced(): Promise<any[]>;
    #private;
}
