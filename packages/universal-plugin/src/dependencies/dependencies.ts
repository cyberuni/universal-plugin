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
	[key: string]: unknown
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
	})

	return { errors, warnings }
}

/** Derives the `dependencies` field one vendor's manifest carries. */
export function translateDependencies(declaration: DependencyDeclaration[], vendor: string): DependencyTranslation {
	if (declaration.length === 0) return { dependencies: null, warnings: [] }
	if (VENDOR_READS_DEPENDENCIES[vendor] !== false) return { dependencies: declaration, warnings: [] }

	const named = declaration.map((entry) => `"${dependencyId(entry)}"`).join(', ')
	const verb = declaration.length === 1 ? 'is' : 'are'
	const fate = CANONICAL_SERVED.has(vendor) ? 'ignored at runtime' : 'dropped from the derived manifest'
	return {
		dependencies: null,
		warnings: [`${vendor} does not read plugin dependencies — ${named} ${verb} ${fate}`],
	}
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
