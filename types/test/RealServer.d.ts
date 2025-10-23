/**
 * Starts an in‑memory JSON server.
 *
 * @param {Record<string, unknown>} files - Map of path → data.
 * @param {{port?: number}} [options={port:0}] - Server options.
 * @returns {Promise<{server: import('node:http').Server, port: number, baseUrl: string}>}
 *          The running server, its actual port, and a ready‑to‑use base URL.
 */
export default function startServer(files: Record<string, unknown>, options?: {
    port?: number | undefined;
} | undefined): Promise<{
    server: import('node:http').Server;
    port: number;
    baseUrl: string;
}>;
