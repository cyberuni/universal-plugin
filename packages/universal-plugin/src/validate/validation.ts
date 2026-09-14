/** Canonical manifest validation: the rules a root `plugin.json` must meet before anything is derived
 *  from it. Two sources, reported apart so an author can tell whose rule they broke:
 *
 *  - **schema** — the Agent Plugins Specification v1.0.0 manifest schema
 *    (https://agent-plugins.org/schemas/1.0.0/plugin.schema.json), plus the canonical shape of the
 *    `dependencies` declaration universal-plugin owns (ADR-0013);
 *  - **vendor** — what a declared vendor requires beyond the standard (codex needs `description` and
 *    `version`, `.research/plugin-schema/conclusion.md`).
 *
 *  Pure domain code: the manifest is handed in already parsed. */

import { validateDependencies } from '../dependencies/dependencies.js'

export const SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'

const UP_NAMESPACE = 'org.cyberuni.universal-plugin'

export interface Violation {
	/** Dotted path of the offending field; `''` for the manifest itself. */
	field: string
	/** The rule that failed, e.g. `required`, `pattern`, `codex`. */
	rule: string
	message: string
}

export interface ManifestValidation {
	valid: boolean
	schemaViolations: Violation[]
	vendorViolations: Violation[]
	/** Declarations the runtimes accept but would ignore; `--strict` promotes the unknown-vendor ones. */
	warnings: string[]
}

export interface ManifestValidationOptions {
	/** Vendor ids this CLI can derive for. */
	knownVendors: ReadonlySet<string>
	/** Limit vendor rules to this one vendor. */
	vendor?: string
	/** Report unknown vendor keys as violations, not only warnings. */
	strict?: boolean
}

/** The schema's `name` pattern: lowercase alphanumerics with inner `.`/`-`, no `--` or `..`. */
const NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/

const STRING_FIELDS = ['version', 'description', 'homepage', 'repository', 'license'] as const
const AUTHOR_FIELDS = new Set(['name', 'email', 'url'])
const TOP_LEVEL_FIELDS = new Set(['$schema', 'name', ...STRING_FIELDS, 'author', 'keywords', 'extensions'])

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks a parsed manifest against the schema and each targeted vendor's rules, collecting every
 *  violation rather than stopping at the first. */
export function validateCanonicalManifest(manifest: unknown, opts: ManifestValidationOptions): ManifestValidation {
	const warnings: string[] = []
	const schemaViolations = schemaRuleViolations(manifest, warnings)
	const vendorViolations: Violation[] = []

	if (isObject(manifest)) {
		const uext = isObject(manifest.extensions) ? manifest.extensions[UP_NAMESPACE] : undefined
		const extension = isObject(uext) ? uext : {}
		const harnesses = isObject(extension.harnesses) ? extension.harnesses : {}
		const declared = [
			...new Set([
				...(Array.isArray(extension.vendors) ? extension.vendors.filter((v) => typeof v === 'string') : []),
				...Object.keys(harnesses),
			]),
		]
		for (const vendor of declared.filter((v) => !opts.knownVendors.has(v))) {
			const message = `Unknown vendor "${vendor}" in harnesses`
			warnings.push(message)
			if (opts.strict) vendorViolations.push({ field: `harnesses.${vendor}`, rule: 'known-vendor', message })
		}

		const targets = opts.vendor
			? [opts.vendor]
			: Array.isArray(extension.vendors)
				? (extension.vendors as string[])
				: Object.keys(harnesses)
		vendorViolations.push(...vendorRuleViolations(manifest, harnesses, targets))
	}

	return {
		valid: schemaViolations.length === 0 && vendorViolations.length === 0,
		schemaViolations,
		vendorViolations,
		warnings,
	}
}

/** The vendor rules alone, scoped to `targets`. A vendor's rules apply only when it is both a target
 *  and declared in `harnesses`, so a codex block that is not being built never blocks the others. */
export function vendorRuleViolations(
	manifest: Record<string, unknown>,
	harnesses: Record<string, unknown>,
	targets: readonly string[],
): Violation[] {
	const violations: Violation[] = []
	if (targets.includes('codex') && harnesses['codex']) {
		for (const field of ['description', 'version']) {
			if (!manifest[field]) {
				violations.push({ field, rule: 'codex', message: `${field} is required when targeting codex` })
			}
		}
	}
	return violations
}

function schemaRuleViolations(manifest: unknown, warnings: string[]): Violation[] {
	if (!isObject(manifest)) {
		return [{ field: '', rule: 'type', message: 'plugin.json must be a JSON object' }]
	}
	const violations: Violation[] = []
	const push = (field: string, rule: string, message: string) => violations.push({ field, rule, message })

	if (manifest.$schema === undefined) push('$schema', 'required', 'required field missing')
	else if (manifest.$schema !== SCHEMA_URL) push('$schema', 'const', `must be "${SCHEMA_URL}"`)

	if (manifest.name === undefined) push('name', 'required', 'required field missing')
	else if (typeof manifest.name !== 'string') push('name', 'type', 'must be a string')
	else if (manifest.name.length === 0 || manifest.name.length > 64) push('name', 'length', 'must be 1–64 characters')
	else if (!NAME_PATTERN.test(manifest.name)) {
		push('name', 'pattern', 'must be lowercase letters, digits, "." and "-", with no "--" or ".."')
	}

	for (const field of STRING_FIELDS) {
		if (manifest[field] !== undefined && typeof manifest[field] !== 'string') push(field, 'type', 'must be a string')
	}

	if (manifest.author !== undefined) {
		if (!isObject(manifest.author)) push('author', 'type', 'must be an object')
		else {
			for (const [key, value] of Object.entries(manifest.author)) {
				if (!AUTHOR_FIELDS.has(key)) push(`author.${key}`, 'additionalProperties', 'unknown author field')
				else if (typeof value !== 'string') push(`author.${key}`, 'type', 'must be a string')
			}
		}
	}

	if (manifest.keywords !== undefined) {
		if (!Array.isArray(manifest.keywords)) push('keywords', 'type', 'must be an array of strings')
		else {
			manifest.keywords.forEach((keyword, index) => {
				if (typeof keyword !== 'string') push(`keywords[${index}]`, 'type', 'must be a string')
			})
		}
	}

	if (manifest.extensions !== undefined) {
		if (!isObject(manifest.extensions)) push('extensions', 'type', 'must be an object keyed by namespace')
		else {
			for (const [namespace, value] of Object.entries(manifest.extensions)) {
				if (!isObject(value)) push(`extensions.${namespace}`, 'type', 'must be an object')
			}
			const uext = manifest.extensions[UP_NAMESPACE]
			if (isObject(uext)) {
				const dependencies = validateDependencies(uext.dependencies)
				for (const error of dependencies.errors) push(`extensions.${UP_NAMESPACE}.dependencies`, 'dependencies', error)
				warnings.push(...dependencies.warnings)
			}
		}
	}

	for (const key of Object.keys(manifest)) {
		if (!TOP_LEVEL_FIELDS.has(key)) {
			push(key, 'additionalProperties', 'not an Agent Plugins 1.0.0 field; move tool-specific data under extensions')
		}
	}

	return violations
}
