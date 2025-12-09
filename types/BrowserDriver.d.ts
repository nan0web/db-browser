export default class BrowserDriver extends DBDriverProtocol {
    static DB_NAME: string;
    static STORE_NAME: string;
    static CACHE_STORE: string;
    constructor(input?: {});
    db: IDBDatabase | null;
    connected: boolean;
    _cache: Map<any, any>;
    _metaCache: Map<any, any>;
    /** @returns {string} */
    get DB_NAME(): string;
    /** @returns {string} */
    get STORE_NAME(): string;
    /** @returns {string} */
    get CACHE_STORE(): string;
    /**
     * Connects to IndexedDB.
     * @returns {Promise<void>}
     */
    connect(): Promise<void>;
    /**
     * Disconnects from IndexedDB and clears caches.
     * @returns {Promise<void>}
     */
    disconnect(): Promise<void>;
    /**
     * @param {'readonly'|'readwrite'} [mode='readonly']
     * @returns {IDBObjectStore}
     */
    _getStore(mode?: "readonly" | "readwrite" | undefined): IDBObjectStore;
    /**
     * @param {'readonly'|'readwrite'} [mode='readonly']
     * @returns {IDBObjectStore}
     */
    _getCacheStore(mode?: "readonly" | "readwrite" | undefined): IDBObjectStore;
    /**
     * Reads a document from the store (with in‑memory cache fallback).
     * @param {string} uri
     * @returns {Promise<any>}
     */
    read(uri: string): Promise<any>;
    /**
     * Writes a document to the store.
     * @param {string} uri
     * @param {any} document
     * @returns {Promise<boolean>}
     */
    write(uri: string, document: any): Promise<boolean>;
    /**
     * Appends (concatenates) a chunk to an existing document.
     * @param {string} uri
     * @param {string} chunk
     * @returns {Promise<boolean>}
     */
    append(uri: string, chunk: string): Promise<boolean>;
    /**
     * @param {string} uri
     * @returns {Promise<DocumentStat>}
     */
    stat(uri: string): Promise<DocumentStat>;
    /**
     * Deletes a document from the store.
     * @param {string} uri
     * @returns {Promise<boolean>}
     */
    delete(uri: string): Promise<boolean>;
}
import { DBDriverProtocol } from '@nan0web/db';
import { DocumentStat } from '@nan0web/db';
