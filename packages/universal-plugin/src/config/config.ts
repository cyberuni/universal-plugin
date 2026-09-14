/** Pure domain for the plugin-registered config store.
 *
 *  `.agents/universal-plugin.json` holds the CLI's own config plus, under
 *  plugin-registered keys, arrays of `{ name, … }` entry objects. This module owns
 *  the rules: which keys are reserved, how an entry merges into a key's array
 *  (append or replace-by-name, position preserved), and how a key's array is read.
 *  No I/O — the caller supplies the parsed config object. */

/** Keys `universal-plugin` owns for its own config — never plugin-registered arrays, so `config add`
 *  refuses them. `packagePath` is a string read by `plugin version` and `publish sync-version`;
 *  `config get` reads it through `getPackagePath` rather than as an array. */
const RESERVED_KEYS = ['packagePath'] as const

export type ConfigFile = Record<string, unknown>

export function isReservedKey(key: string): boolean {
	return (RESERVED_KEYS as readonly string[]).includes(key)
}

/** The one reader of `packagePath`: the directory holding the npm package that ships this plugin,
 *  as declared — a path relative to the plugin root, the directory holding `plugin.json` and
 *  `.agents/`. An absent key, a non-string, or an empty string all mean "no npm package": the
 *  author-picks release model (ADR-0010 §2). `plugin version`, `publish sync-version`, and
 *  `config get` share this so no reader can disagree on what a declaration means (issue #79). */
export function getPackagePath(config: ConfigFile): string | null {
	const value = config.packagePath
	return typeof value === 'string' && value.length > 0 ? value : null
}

/** The array registered at `key`, or an empty array when the key is absent or non-array. */
export function getEntries(config: ConfigFile, key: string): unknown[] {
	const value = config[key]
	return Array.isArray(value) ? value : []
}

export interface AddResult {
	config: ConfigFile
	action: 'appended' | 'replaced'
	name: string
}

/** Merge `entry` into the array at `key`: append when no element shares its `name`,
 *  else replace that element in place (array position preserved). Returns a new config
 *  object; the input is not mutated. Throws when `entry` is not a JSON object or lacks a
 *  non-empty `name` (the merge dedup key). Reserved-key rejection is the caller's guard. */
export function addEntry(config: ConfigFile, key: string, entry: unknown): AddResult {
	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		throw new Error('error: --entry must be a JSON object')
	}
	const name = (entry as Record<string, unknown>).name
	if (typeof name !== 'string' || name.length === 0) {
		throw new Error('error: --entry must include a non-empty "name" field')
	}

	const existing = getEntries(config, key)
	const index = existing.findIndex(
		(e) => typeof e === 'object' && e !== null && (e as Record<string, unknown>).name === name,
	)

	let next: unknown[]
	let action: 'appended' | 'replaced'
	if (index === -1) {
		next = [...existing, entry]
		action = 'appended'
	} else {
		next = existing.slice()
		next[index] = entry
		action = 'replaced'
	}

	return { config: { ...config, [key]: next }, action, name }
}
