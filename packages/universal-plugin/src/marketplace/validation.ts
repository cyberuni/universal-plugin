import type { MarketplaceTarget } from './marketplace.js'

/** One thing a catalog says that its runtime will reject, named by where it says it. */
export interface CatalogIssue {
	/** Dotted path inside the catalog, e.g. `owner` or `plugins[0].repository`. */
	path: string
	message: string
}

/** The rules below are the official Claude Code marketplace schema
 *  (https://json.schemastore.org/claude-code-marketplace.json, generated 2026-04-23) reduced to the
 *  keys this project writes or merges. Claude Code loads a catalog through that schema, so a shape
 *  it rejects is a catalog nobody can install from — `owner` as a string and an npm-style
 *  `repository` object are the two that reach a repository unnoticed, because both are what
 *  `package.json` carries.
 *
 *  Cursor documents the same shape (`.research/local-marketplaces`, E-CUR-M6) and Copilot CLI reads
 *  the Claude catalog, so all three targets are checked against these rules. Codex's catalog is a
 *  different document and has its own rules below. */

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function typeName(value: unknown): string {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'array'
	return typeof value
}

function checkString(issues: CatalogIssue[], path: string, value: unknown, { required = false } = {}): void {
	if (value === undefined) {
		if (required) issues.push({ path, message: 'is required' })
		return
	}
	if (typeof value !== 'string') {
		issues.push({ path, message: `must be a string, not ${typeName(value)}` })
		return
	}
	if (required && value.trim() === '') issues.push({ path, message: 'must not be empty' })
}

function checkStringArray(issues: CatalogIssue[], path: string, value: unknown): void {
	if (value === undefined) return
	if (!Array.isArray(value)) {
		issues.push({ path, message: `must be an array of strings, not ${typeName(value)}` })
		return
	}
	value.forEach((item, index) => {
		checkString(issues, `${path}[${index}]`, item)
	})
}

/** `owner` and a plugin's `author` share one shape: an object carrying a required `name`. A string
 *  there is the mistake `package.json`'s `"author": "Name <email>"` invites; Claude Code reports
 *  `expected object, received string` and refuses the catalog. */
function checkPerson(issues: CatalogIssue[], path: string, value: unknown, { required = false } = {}): void {
	if (value === undefined) {
		if (required) issues.push({ path, message: 'is required' })
		return
	}
	if (!isObject(value)) {
		const remedy = typeof value === 'string' ? ` — write { "name": ${JSON.stringify(value)} }` : ''
		issues.push({ path, message: `must be an object with a name, not ${typeName(value)}${remedy}` })
		return
	}
	checkString(issues, `${path}.name`, value.name, { required: true })
	checkString(issues, `${path}.email`, value.email)
	checkString(issues, `${path}.url`, value.url)
}

/** The source forms the official schema accepts: a `./`-prefixed repository-relative path, or one of
 *  the tagged remote objects. */
const REMOTE_SOURCE_KEYS: Record<string, string[]> = {
	npm: ['package'],
	url: ['url'],
	github: ['repo'],
	'git-subdir': ['url', 'path'],
}

function checkClaudeSource(issues: CatalogIssue[], path: string, value: unknown): void {
	if (value === undefined) {
		issues.push({ path, message: 'is required' })
		return
	}
	if (typeof value === 'string') {
		if (!value.startsWith('./')) {
			issues.push({ path, message: `must be a "./"-prefixed repository-relative path, not ${JSON.stringify(value)}` })
		}
		return
	}
	if (!isObject(value)) {
		issues.push({ path, message: `must be a "./" path or a source object, not ${typeName(value)}` })
		return
	}
	const kind = value.source
	if (typeof kind !== 'string' || !(kind in REMOTE_SOURCE_KEYS)) {
		issues.push({
			path: `${path}.source`,
			message: `must be one of ${Object.keys(REMOTE_SOURCE_KEYS).join(', ')}`,
		})
		return
	}
	for (const key of REMOTE_SOURCE_KEYS[kind] as string[]) {
		checkString(issues, `${path}.${key}`, value[key], { required: true })
	}
}

function checkClaudeEntry(issues: CatalogIssue[], path: string, entry: unknown): void {
	if (!isObject(entry)) {
		issues.push({ path, message: `must be an object, not ${typeName(entry)}` })
		return
	}
	checkString(issues, `${path}.name`, entry.name, { required: true })
	checkClaudeSource(issues, `${path}.source`, entry.source)
	checkString(issues, `${path}.version`, entry.version)
	checkString(issues, `${path}.description`, entry.description)
	checkString(issues, `${path}.homepage`, entry.homepage)
	// npm writes `repository` as `{ type, url }`; the catalog wants the URL alone.
	if (isObject(entry.repository) && typeof entry.repository.url === 'string') {
		issues.push({
			path: `${path}.repository`,
			message: `must be a string, not object — write ${JSON.stringify(entry.repository.url)}`,
		})
	} else {
		checkString(issues, `${path}.repository`, entry.repository)
	}
	checkString(issues, `${path}.license`, entry.license)
	checkString(issues, `${path}.category`, entry.category)
	checkPerson(issues, `${path}.author`, entry.author)
	checkStringArray(issues, `${path}.keywords`, entry.keywords)
	checkStringArray(issues, `${path}.tags`, entry.tags)
}

function validateClaudeShaped(catalog: Json): CatalogIssue[] {
	const issues: CatalogIssue[] = []
	checkString(issues, 'name', catalog.name, { required: true })
	checkPerson(issues, 'owner', catalog.owner, { required: true })
	checkString(issues, 'description', catalog.description)
	checkString(issues, 'version', catalog.version)
	if (catalog.plugins === undefined) {
		issues.push({ path: 'plugins', message: 'is required' })
		return issues
	}
	if (!Array.isArray(catalog.plugins)) {
		issues.push({ path: 'plugins', message: `must be an array, not ${typeName(catalog.plugins)}` })
		return issues
	}
	catalog.plugins.forEach((entry, index) => {
		checkClaudeEntry(issues, `plugins[${index}]`, entry)
	})
	return issues
}

/** Codex reads a document of its own: no `owner`, a display name under `interface`, and an object
 *  `source` naming a local path (`.research/local-marketplaces`, E-CODEX-M11). It tolerates extra
 *  keys and requires no entry `version`. */
function validateCodex(catalog: Json): CatalogIssue[] {
	const issues: CatalogIssue[] = []
	checkString(issues, 'name', catalog.name, { required: true })
	if (catalog.interface !== undefined && !isObject(catalog.interface)) {
		issues.push({ path: 'interface', message: `must be an object, not ${typeName(catalog.interface)}` })
	} else if (isObject(catalog.interface)) {
		checkString(issues, 'interface.displayName', catalog.interface.displayName)
	}
	if (catalog.plugins === undefined) {
		issues.push({ path: 'plugins', message: 'is required' })
		return issues
	}
	if (!Array.isArray(catalog.plugins)) {
		issues.push({ path: 'plugins', message: `must be an array, not ${typeName(catalog.plugins)}` })
		return issues
	}
	catalog.plugins.forEach((entry, index) => {
		const path = `plugins[${index}]`
		if (!isObject(entry)) {
			issues.push({ path, message: `must be an object, not ${typeName(entry)}` })
			return
		}
		checkString(issues, `${path}.name`, entry.name, { required: true })
		checkString(issues, `${path}.version`, entry.version)
		checkString(issues, `${path}.category`, entry.category)
		if (typeof entry.source === 'string') {
			checkClaudeSource(issues, `${path}.source`, entry.source)
		} else if (isObject(entry.source)) {
			checkString(issues, `${path}.source.source`, entry.source.source, { required: true })
			if (entry.source.source === 'local') {
				checkClaudeSource(issues, `${path}.source.path`, entry.source.path)
			}
		} else {
			issues.push({ path: `${path}.source`, message: 'is required' })
		}
	})
	return issues
}

/** Every issue a target's runtime would raise against this catalog, empty when it loads. */
export function validateCatalog(target: MarketplaceTarget, catalog: unknown): CatalogIssue[] {
	if (!isObject(catalog)) return [{ path: '', message: `catalog must be a JSON object, not ${typeName(catalog)}` }]
	return target === 'codex' ? validateCodex(catalog) : validateClaudeShaped(catalog)
}

/** The same check against a catalog still in its serialized form. Text that does not parse is one
 *  issue rather than a thrown error, so a caller checking four files reports all four. */
export function validateCatalogContent(target: MarketplaceTarget, content: string): CatalogIssue[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch (err) {
		return [{ path: '', message: `is not valid JSON: ${err instanceof Error ? err.message : String(err)}` }]
	}
	return validateCatalog(target, parsed)
}

/** One error message naming the file and every issue in it, for a caller that fails loud. */
export function formatCatalogIssues(file: string, issues: CatalogIssue[]): string {
	const lines = issues.map((issue) => `  ${issue.path === '' ? file : `${issue.path}`} ${issue.message}`)
	return `error: catalog "${file}" does not match the marketplace schema:\n${lines.join('\n')}`
}
