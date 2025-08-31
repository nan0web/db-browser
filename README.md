# @nan0web/db-browser

Browser Database client for any data to fetch or api to connect.

## Features

- **Document Management**: Load, save, write, and delete documents through HTTP requests (GET, POST, PUT, DELETE)
- **Timeout Handling**: Built-in request timeout management for better reliability
- **Error Handling**: Proper HTTP error handling with informative error messages
- **Inheritance Support**: DataDB extends BrowserDB to support data inheritance from parent directories
- **Reference Resolution**: Automatically resolve document references using $ref syntax
- **Document Extensions**: Support for extending documents using $extend syntax

## Installation

```bash
npm install @nan0web/db-browser
```

## Usage

### Basic BrowserDB Usage

```javascript
import BrowserDB from '@nan0web/db-browser'

// Initialize with default settings
const db = new BrowserDB({
	host: 'https://api.example.com',
	root: '/data/',
})

// Load a document
const data = await db.loadDocument('users.json')

// Save a document (POST)
await db.saveDocument('users.json', { name: 'John', age: 30 })

// Write a document (PUT)
await db.writeDocument('users.json', { name: 'Jane', age: 25 })

// Delete a document
await db.dropDocument('users.json')
```

### DataDB with Inheritance and References

> !!! Still with some errors, BrowserDB without.

```javascript
import DataDB from '@nan0web/db-browser'

const db = new DataDB({
	host: 'https://api.example.com',
	root: '/data/'
})

// Load merged data with inheritance, extensions, and references resolved
const data = await db.fetchMerged('en/about')
```

## API

### BrowserDB

#### Constructor
```javascript
new BrowserDB({
	host = window.location.origin,
	root = "/",
	extension = '.json',
	indexFile = 'index.json',
	localIndexFile = 'index.d.json',
	timeout = 6000,
	fetchFn = window.fetch,
})
```

#### Methods
- `loadDocument(uri)` - Load a document from the specified URI
- `saveDocument(uri, document)` - Save a document using POST method
- `writeDocument(uri, document)` - Write a document using PUT method
- `dropDocument(uri)` - Delete a document using DELETE method
- `load()` - Load index data from local or global index file

### DataDB

DataDB extends BrowserDB with additional data management capabilities.

#### Methods
- `fetchMerged(uri)` - Fetch and merge data from multiple sources following nano-db-fetch patterns
- `mergeInheritedData(path, data)` - Merge inherited data from parent directories
- `resolveReferences(data)` - Resolve document references recursively
- `processExtensions(data)` - Process document extensions and merge data recursively

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

[ISC](./LICENSE)
