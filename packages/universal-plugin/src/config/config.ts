/** Pure domain for the plugin-registered config store.
 *
 *  `.agents/universal-plugin.json` holds the CLI's own config plus, under
 *  plugin-registered keys, arrays of `{ name, … }` entry objects. This module owns
 *  the rules: which keys are reserved, how an entry merges into a key's array
 *  (append or replace-by-name, position preserved), and how a key's array is read.
 *  No I/O — the caller supplies the parsed config object. */

/** Keys `universal-plugin` owns for its own config — never plugin-registered arrays.
 *  `packagePath` is a string read by `publish sync-version`. */
const RESERVED_KEYS = ['packagePath'] as const

export type ConfigFile = Record<string, unknown>

export function isReservedKey(key: string): boolean {
	return (RESERVED_KEYS as readonly string[]).includes(key)
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
