/**
 * Resolves path segments to absolute URL synchronously
 * @param {object} context - Context with cwd and root properties
 * @param {...string} args - Path segments
 * @returns {string} Resolved absolute URL
 */
export function resolveSync(context: object, ...args: string[]): string;
export default resolveSync;
