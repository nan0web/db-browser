/**
 * Resolves path segments to absolute URL synchronously
 * @param {object} context - Context with cwd and root properties
 * @param {...string} args - Path segments
 * @returns {string} Resolved absolute URL
 */
export function resolveSync(context, ...args) {
	// If no arguments, return the root URL
	if (args.length === 0) {
		return context.root
	}

	// Filter out undefined/null values and coerce to strings
	/** @type {string[]} */
	let validArgs = args.filter(arg => arg != null).map(String)

	// If only an empty string was provided, return root
	if (validArgs.length === 1 && validArgs[0] === '') {
		return context.root
	}

	// Ensure we have a valid base URL
	const base = context.cwd || 'http://localhost'
	let root = String(context.root || '/')
	if (!root.endsWith("/")) root += "/"

	try {
		// Process arguments through URL API
		let url

		// If first argument is remote, use it directly
		if (isRemote(validArgs[0])) {
			url = new URL(validArgs[0])
			// If it's the same host as base, resolve it relative to root
			if (url.origin === new URL(base).origin) {
				if (validArgs.length > 1) {
					// Process remaining args relative to the remote path
					return resolveSync({ ...context, root: url.pathname }, ...validArgs.slice(1))
				}
				return url.pathname + url.search + url.hash
			}
			return url.href
		}

		// Create base URL from context
		const baseUrl = new URL(root, base)

		// If no valid arguments, return the base URL path
		if (validArgs.length === 0) {
			return baseUrl.pathname
		}

		// Cut until absolute
		let cutUntil = -1
		for (let i = validArgs.length - 1; i >= 0; i--) {
			if (validArgs[i].startsWith("/") || isRemote(validArgs[i])) {
				cutUntil = i
				break
			}
		}
		if (cutUntil > 0) {
			validArgs = validArgs.slice(cutUntil)
		}

		const pathSegments = validArgs.join('/').split('/').filter(segment => segment !== '')
		let joinedPath = pathSegments.length > 0 ? pathSegments.join('/') : ''
		if (cutUntil > -1) joinedPath = `/${joinedPath}`

		// Resolve against base URL
		if (joinedPath.startsWith('/')) {
			// Absolute path - resolve against the origin (root of the domain)
			const originUrl = new URL(base)
			const [path0, ...search] = joinedPath.split("?")
			const [path1, ...vars] = path0.split("&")
			const [path, ...hash] = path1.split('#')

			originUrl.pathname = path
			originUrl.search = search.join("?") + vars.join("&")
			originUrl.hash = hash.join('#')
			url = originUrl
		} else {
			// Relative path - resolve against base URL
			url = new URL(joinedPath, baseUrl.href)
		}

		const href = url.href
		const baseHref = new URL(base).href

		// Return the full path without origin for local URLs
		if (href.startsWith(baseHref)) {
			return url.pathname + url.search + url.hash
		}

		return href
	} catch (error) {
		// Fallback to simple path resolution
		console.error("Error in resolveSync", { args, error })
		return resolveSyncSimple(context, ...args)
	}
}

/**
 * Check if URI is remote (full URL)
 * @param {string} uri - URI to check
 * @returns {boolean} True if URI is remote
 */
function isRemote(uri) {
	return uri.startsWith('http://') || uri.startsWith('https://')
}

/**
 * Simple path resolution fallback
 * @param {object} context - Context with cwd and root properties
 * @param {...string} args - Path segments
 * @returns {string} Resolved path
 */
function resolveSyncSimple(context, ...args) {
	// If no arguments, return root
	if (args.length === 0) return context.root

	// Filter out undefined/null values and coerce to strings
	const validArgs = args.filter(arg => arg != null).map(String)

	// If only an empty string was provided, return root
	if (validArgs.length === 1 && validArgs[0] === '') {
		return context.root
	}

	// If first argument is remote, return it as is
	if (isRemote(validArgs[0])) return validArgs[0]

	// Start with root
	let result = context.root || '/'

	// Process each argument
	for (const part of validArgs) {
		if (part === '' || part === '.') continue

		if (isRemote(part)) {
			// Remote URL resets everything
			return part
		} else if (part.startsWith('/')) {
			// Absolute path - should be resolved from root of domain, not context root
			result = part
		} else if (part === '..') {
			// Go up one directory
			const root = context.root || '/'
			const rootNormalized = root.endsWith('/') ? root : root + '/'
			const parts = result.substring(rootNormalized.length).split('/').filter(Boolean)
			if (parts.length > 0) {
				parts.pop()
				result = rootNormalized + parts.join('/')
				if (result !== root && !result.endsWith('/')) result += '/'
			}
		} else {
			// Append relative path
			const root = context.root || '/'

			// If result equals root and root doesn't end with slash, append part directly
			if (result === root) {
				if (!result.endsWith('/')) result += '/'
				result += part
			} else {
				const normalizedPart = part.startsWith('/') ? part.substring(1) : part
				if (!result.endsWith('/')) result += '/'
				result += normalizedPart
			}
		}
	}

	// Add back query and hash from last argument if they exist
	const lastArg = validArgs[validArgs.length - 1]
	if (lastArg.includes('?') || lastArg.includes('#')) {
		const match = lastArg.match(/(\?[^#]*)?(#.*)?$/)
		const query = match?.[1] || ''
		const hash = match?.[2] || ''
		// Remove any existing query/hash from result before adding new ones
		const pathPart = result.split('?')[0].split('#')[0]
		result = pathPart + (query || '') + (hash || '')
	}

	return result
}

export default resolveSync
