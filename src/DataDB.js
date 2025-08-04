import BrowserDB from './BrowserDB.js'

/**
 * DataDB extends BrowserDB to provide enhanced data management capabilities
 * by merging data from parent directories, global variables, references, and
 * extended documents using nano-db-fetch patterns.
 */
class DataDB extends BrowserDB {
	/**
	 * @param {object} input
	 * @param {string} [input.extension='.json']
	 * @param {string} [input.indexFile='index.json']
	 * @param {string} [input.localIndexFile='index.d.json']
	 * @param {number} [input.timeout=6_000] - Request timeout in milliseconds
	 * @param {Function} [input.fetchFn] - Custom fetch function, @nanoweb/http-node for node.js.
	 */
	constructor(input = {}) {
		super(input)
		/** @type {Record<string, object>} */
		this.inheritance = {}
	}

	/**
	 * Merges data from multiple sources following nano-db-fetch patterns
	 * @param {string} uri - The URI to fetch and merge data for
	 * @returns {Promise<any>} Merged data object
	 */
	async fetchMerged(uri) {
		// Handle extension-less URIs by adding the default extension
		let fullUri = uri
		if (!uri.endsWith(this.extension) && !uri.endsWith('.json')) {
			fullUri = uri + this.extension
		}

		// Load the document first
		let data = await this.loadDocument(fullUri)

		// Process extensions recursively
		data = await this.processExtensions(data)

		// Merge inherited data
		data = this.mergeInheritedData(uri, data)

		// Resolve references
		data = await this.resolveReferences(data)

		return data
	}

	/**
	 * Merges inherited data from parent directories and global context
	 * @param {string} path - Document path
	 * @param {object} data - Document data
	 * @returns {object} Merged data
	 */
	mergeInheritedData(path, data) {
		// Process path segments to build inheritance chain
		const segments = path.split('/').filter(segment => segment !== '')
		const inheritanceChain = segments.map((_, index) =>
			segments.slice(0, index + 1).join('/') + '/'
		)

		// Start with global data inheritance
		let mergedData = {}

		// Apply inheritance in hierarchical order
		for (const dir of inheritanceChain) {
			const dirData = this.inheritance[dir] || {}
			mergedData = this.mergeObjects(mergedData, dirData)
		}

		// Apply document-specific data
		return this.mergeObjects(mergedData, data)
	}

	/**
	 * Deep merge two objects, preserving array structure
	 * @param {object} target - Target object
	 * @param {object} source - Source object
	 * @returns {object} Merged object
	 */
	mergeObjects(target, source) {
		if (typeof target !== 'object' || target === null ||
			typeof source !== 'object' || source === null) {
			return source
		}

		const result = Array.isArray(target) ? [] : {}

		// Copy target properties
		for (const key in target) {
			result[key] = target[key]
		}

		// Merge source properties
		for (const key in source) {
			if (source.hasOwnProperty(key)) {
				if (typeof source[key] === 'object' && source[key] !== null &&
					typeof result[key] === 'object' && result[key] !== null) {
					result[key] = this.mergeObjects(result[key], source[key])
				} else {
					result[key] = source[key]
				}
			}
		}

		return result
	}

	/**
	 * Handles document references and resolves them recursively
	 * @param {object} data - Document data with potential references
	 * @returns {Promise<object>} Data with resolved references
	 */
	async resolveReferences(data) {
		if (typeof data !== 'object' || data === null) {
			return data
		}

		const resolvedData = Array.isArray(data) ? [...data] : { ...data }

		// Process all references in the data object
		for (const [key, value] of Object.entries(resolvedData)) {
			if (typeof value === 'string' && value.startsWith('$ref:')) {
				const refPath = value.substring(5)
				try {
					const refValue = await this.loadDocument(refPath)
					resolvedData[key] = refValue
				} catch (err) {
					// If reference can't be resolved, keep original value
					resolvedData[key] = value
				}
			} else if (typeof value === 'object' && value !== null) {
				resolvedData[key] = await this.resolveReferences(value)
			}
		}

		return resolvedData
	}

	/**
	 * Processes document extensions and merges data recursively
	 * @param {object} data - Document data with potential extensions
	 * @returns {Promise<object>} Merged extended data
	 */
	async processExtensions(data) {
		if (typeof data !== 'object' || data === null) {
			return data
		}

		const extendedData = Array.isArray(data) ? [...data] : { ...data }

		if (extendedData.$extend) {
			const parentUri = extendedData.$extend
			try {
				const parentData = await this.loadDocument(parentUri)
				// Process extensions in parent data recursively
				const processedParentData = await this.processExtensions(parentData)
				// Remove the extends property and merge parent data
				delete extendedData.$extend
				// Merge parent data with current data (current data takes precedence)
				return this.mergeObjects(processedParentData, extendedData)
			} catch (err) {
				// If parent can't be loaded, keep original data
				return extendedData
			}
		}

		return extendedData
	}
}

export default DataDB
