/** Plugin dependencies: one canonical declaration of the plugins this plugin needs, delivered to the
 *  vendors that read one and dropped with a warning for the vendors that do not (ADR-0013).
 *
 *  The canonical form is Claude Code's, because Claude Code is the only runtime that reads a
 *  dependency at all: an array whose entries are a plugin name — optionally `@marketplace`-qualified
 *  — or an object carrying that name plus a constraint. Pure domain code; reading and writing the
 *  manifests belongs to the build. */

import semver from 'semver'

/** A dependency as authored: a name, or a name with a constraint beside it. */
export type DependencyDeclaration = string | DependencyObject

export interface DependencyObject {
	name: string
	marketplace?: string
	/** Semver range. Enforced by Claude Code against the installed plugin's version. */
	version?: string
	/** Commit sha to pin to, for a dependency installed from git. */
	sha?: string
	/** Where the dependency is distributed from, in a catalog's tagged source shape — e.g.
	 *  `{ "source": "npm", "package": "cyber-asana" }`. Ours, not the runtime's: it lets the build list
	 *  the dependency in the catalog it refreshes, and is stripped from every derived manifest. */
	source?: DependencySource
	[key: string]: unknown
}

/** A catalog source as a dependency declares it: the tagged shape a marketplace entry takes. */
type DependencySource = { source: string } & Record<string, unknown>

/** What the build needs to know about one marketplace catalog to say whether a dependency resolves
 *  through it. */
export interface DependencyCatalog {
	/** Repository-relative path, for the message. */
	path: string
	/** The marketplace's own name; a bare dependency resolves against it. */
	name: string
	/** Every plugin name the catalog lists. */
	plugins: string[]
	/** `allowCrossMarketplaceDependenciesOn`: the marketplaces a dependency may be qualified with. */
	allowedMarketplaces?: string[]
}

/** A catalog entry the build may add for a dependency: its name and where it comes from. */
export interface DependencyCatalogEntry {
	name: string
	source: DependencySource
}

export interface DependencyValidation {
	errors: string[]
	warnings: string[]
}

export interface DependencyTranslation {
	/** The dependencies this vendor's manifest carries, or null when it reads none. */
	dependencies: DependencyDeclaration[] | null
	warnings: string[]
}

/** Vendors that read a `dependencies` field. Sources, re-verified August 2026:
 *  Claude Code 2.1.235 (`claude plugin validate` accepts every form below, and its resolver installs,
 *  enables, and version-checks what it finds); Cursor 2026.07.01 and Codex 0.147.0 both parse a plugin
 *  manifest with no such field; GitHub Copilot CLI documents none
 *  (docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).
 *  `.research/plugin-schema/` carries the evidence and the recheck triggers. */
const VENDOR_READS_DEPENDENCIES: Record<string, boolean> = {
	'claude-code': true,
	cursor: false,
	codex: false,
	'copilot-cli': false,
}

/** Vendors the canonical root manifest serves as-is: nothing is derived for them, so a declaration
 *  they cannot read is ignored at runtime rather than dropped from a file. */
const CANONICAL_SERVED = new Set(['copilot-cli'])

/** What Claude Code accepts as a dependency string: a plugin name, an optional `@marketplace`, and an
 *  optional `@^…` range tail that the runtime strips before resolving. */
const DEPENDENCY_STRING = /^[A-Za-z0-9][-A-Za-z0-9._]*(@[A-Za-z0-9][-A-Za-z0-9._]*)?(@\^[^@]*)?$/
const RANGE_TAIL = /@(\^[^@]*)$/

/** Checks the shape of a `dependencies` declaration. Errors are author mistakes the runtime would
 *  reject; warnings are declarations the runtime accepts and then quietly ignores. */
export function validateDependencies(declaration: unknown): DependencyValidation {
	const errors: string[] = []
	const warnings: string[] = []
	if (declaration === undefined || declaration === null) return { errors, warnings }

	if (!Array.isArray(declaration)) {
		errors.push('dependencies must be an array of plugin names or objects, not an object map')
		return { errors, warnings }
	}

	declaration.forEach((entry, index) => {
		if (typeof entry === 'string') {
			if (!DEPENDENCY_STRING.test(entry)) {
				errors.push(`dependencies[${index}] "${entry}" is not a plugin name, optionally qualified with @marketplace`)
				return
			}
			const range = entry.match(RANGE_TAIL)?.[1]
			if (range) warnings.push(discardedRangeWarning(index, entry, range))
			return
		}

		if (!isDependencyObject(entry)) {
			errors.push(`dependencies[${index}] must be a plugin name or an object with a name`)
			return
		}

		if (!DEPENDENCY_STRING.test(dependencyId(entry))) {
			errors.push(
				`dependencies[${index}] "${dependencyId(entry)}" is not a plugin name, optionally qualified with @marketplace`,
			)
		}
		if (entry.version !== undefined && semver.validRange(entry.version) === null) {
			errors.push(`dependencies[${index}].version "${entry.version}" is not a semver range`)
		}
		if (entry.source !== undefined && !isDependencySource(entry.source)) {
			errors.push(
				`dependencies[${index}].source must be a catalog source such as { "source": "npm", "package": "${entry.name}" }`,
			)
		}
	})

	return { errors, warnings }
}

/** Derives the `dependencies` field one vendor's manifest carries. */
export function translateDependencies(declaration: DependencyDeclaration[], vendor: string): DependencyTranslation {
	if (declaration.length === 0) return { dependencies: null, warnings: [] }
	if (VENDOR_READS_DEPENDENCIES[vendor] !== false) return { dependencies: declaration.map(withoutSource), warnings: [] }

	const named = declaration.map((entry) => `"${dependencyId(entry)}"`).join(', ')
	const verb = declaration.length === 1 ? 'is' : 'are'
	const fate = CANONICAL_SERVED.has(vendor) ? 'ignored at runtime' : 'dropped from the derived manifest'
	return {
		dependencies: null,
		warnings: [`${vendor} does not read plugin dependencies — ${named} ${verb} ${fate}`],
	}
}

/** Whether this vendor's marketplace catalog is where its dependencies resolve, so the build checks
 *  them against it. A runtime that reads no dependency has nothing to resolve. */
export function vendorResolvesDependencies(vendor: string): boolean {
	return VENDOR_READS_DEPENDENCIES[vendor] === true
}

/** The dependencies the build may list in a catalog: each one that resolves through it — bare, or
 *  qualified with the catalog's own name — and carries a source saying where it comes from. A
 *  dependency without a source is never listed: nothing here knows where it is distributed from. */
export function dependencyCatalogEntries(declaration: unknown, catalogName: string): DependencyCatalogEntry[] {
	return declaredEntries(declaration).flatMap((entry) => {
		if (typeof entry === 'string' || !isDependencySource(entry.source)) return []
		const { marketplace } = parseDependency(entry)
		if (marketplace !== undefined && marketplace !== catalogName) return []
		return [{ name: entry.name, source: entry.source }]
	})
}

/** Checks that each declared dependency resolves through one catalog, offline. A bare name resolves
 *  only against the marketplace the dependent is installed from, so the catalog must list it; a name
 *  qualified with another marketplace is refused unless the catalog lists that marketplace in
 *  `allowCrossMarketplaceDependenciesOn` (`.research/plugin-schema`). Whether the other marketplace
 *  really lists the dependency is resolution, which stays out of scope (ADR-0013 §5). */
export function catalogDependencyIssues(declaration: unknown, catalog: DependencyCatalog): string[] {
	const issues: string[] = []
	const where = `"${catalog.path}" (marketplace "${catalog.name}")`
	for (const entry of declaredEntries(declaration)) {
		const { name, marketplace } = parseDependency(entry)
		if (marketplace === undefined || marketplace === catalog.name) {
			if (catalog.plugins.includes(name)) continue
			issues.push(
				`dependency "${name}" is not listed in ${where}, and a bare name resolves only there — list it in that catalog (universal-plugin marketplace add npm:<package>), or qualify it with the marketplace that lists it ({ "name": "${name}", "marketplace": "<marketplace>" }) and add that marketplace to the catalog's allowCrossMarketplaceDependenciesOn`,
			)
			continue
		}
		if (catalog.allowedMarketplaces?.includes(marketplace)) continue
		issues.push(
			`dependency "${name}@${marketplace}" names marketplace "${marketplace}", which ${where} does not list in allowCrossMarketplaceDependenciesOn, so the dependency is refused at install — add "${marketplace}" to that list`,
		)
	}
	return issues
}

/** The entries of a declaration whose shape the runtime accepts. Anything else was already reported
 *  by `validateDependencies`, and a check built on top of it has nothing to add. */
function declaredEntries(declaration: unknown): DependencyDeclaration[] {
	if (!Array.isArray(declaration)) return []
	return declaration.filter((entry): entry is DependencyDeclaration => {
		if (typeof entry === 'string') return DEPENDENCY_STRING.test(entry)
		return isDependencyObject(entry) && DEPENDENCY_STRING.test(dependencyId(entry))
	})
}

function parseDependency(entry: DependencyDeclaration): { name: string; marketplace?: string } {
	const [name = '', marketplace] = dependencyId(entry).split('@')
	return marketplace === undefined ? { name } : { name, marketplace }
}

function withoutSource(entry: DependencyDeclaration): DependencyDeclaration {
	if (typeof entry === 'string' || !('source' in entry)) return entry
	const { source: _source, ...rest } = entry
	return rest as DependencyObject
}

function isDependencySource(value: unknown): value is DependencySource {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as DependencySource).source === 'string'
	)
}

/** The `name[@marketplace]` a runtime resolves a declaration to, minus any constraint beside it. */
function dependencyId(entry: DependencyDeclaration): string {
	if (typeof entry === 'string') return entry.replace(RANGE_TAIL, '')
	return entry.marketplace ? `${entry.name}@${entry.marketplace}` : entry.name
}

function isDependencyObject(entry: unknown): entry is DependencyObject {
	return (
		typeof entry === 'object' &&
		entry !== null &&
		!Array.isArray(entry) &&
		typeof (entry as DependencyObject).name === 'string' &&
		(entry as DependencyObject).name.length > 0
	)
}

/** A range in the string form parses and is then thrown away: Claude Code strips the `@^…` tail
 *  before resolving, and reads a constraint only off the object form. Naming the object the author
 *  meant to write is the whole remedy. */
function discardedRangeWarning(index: number, entry: string, range: string): string {
	const [name, marketplace] = entry.replace(RANGE_TAIL, '').split('@')
	const object = marketplace
		? `{ "name": "${name}", "marketplace": "${marketplace}", "version": "${range}" }`
		: `{ "name": "${name}", "version": "${range}" }`
	return `dependencies[${index}] "${entry}" carries a version range the runtime discards — declare ${object} for a range that is enforced`
}
