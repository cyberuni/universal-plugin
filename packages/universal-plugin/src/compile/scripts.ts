/** Compiled skill scripts (issue #177) — the rules, with no I/O.
 *
 *  A skill does not always travel with its package. pnpm links or copies each skill folder on its own
 *  into an agent's skill directory, and a plugin cache keeps only what the plugin ships, so a script
 *  that reaches back into the package (`../../../../bin/cli.mjs`) finds nothing. The build therefore
 *  compiles each declared entry into one self-contained `.mjs` inside the skill: the source, its tests
 *  and stories stay in the package, and the skill gets only the built file.
 *
 *  Each compiled file starts with a header that names its source and embeds the script's data: the
 *  package and bin that ship it, the plugin version, and the command map — every declared command
 *  path and the entry that runs it — so a script can render a reference to another command as a
 *  command line it can run. */

/** One declared entry: where the compiled file goes and what it is compiled from, both relative to
 *  the plugin root. `command` is the CLI command path the entry runs (`plugin build`), when it runs
 *  one. */
export interface ScriptEntry {
	output: string
	source: string
	command?: string
}

/** The data every compiled script carries, read at run time from `globalThis[SCRIPT_GLOBAL]`. */
export interface ScriptData {
	/** The npm package that ships the plugin; `null` when the plugin ships to no package. */
	package: string | null
	/** The package's bin name, for `pnpm exec <bin>`; `null` when it declares none. */
	bin: string | null
	/** The plugin version, from the canonical `plugin.json` — never from `package.json` (#179). */
	version: string | null
	/** This script's own path, relative to the plugin root. */
	entry: string
	/** Command path → the entry that runs it, relative to the plugin root. */
	commands: Record<string, string>
}

/** The global the header assigns the script data to. Framework-neutral: a script's own code, or the
 *  library it inlines, reads it; universal-plugin depends on neither. */
export const SCRIPT_GLOBAL = '__SKILL_SCRIPT__'

/** The size above which a compiled script should not be committed into a skill. Over it, the skill
 *  should call the installed CLI instead: `pnpm exec <bin>` (pnpm links only direct dependencies, so
 *  the CLI is there) with a pinned `npx` fallback. */
export const SIZE_BUDGET_BYTES = 150 * 1024

const HEADER_PREFIX = '// Compiled by `universal-plugin plugin build` from '
const DATA_PREFIX = `globalThis.${SCRIPT_GLOBAL} = `

/** Reads the `scripts` declaration of the canonical manifest's extension: a map from output path to
 *  either a source path or `{ source, command? }`. A malformed declaration or entry is an error, never
 *  a silent skip — a script the author declared and the build dropped is a skill that breaks later. */
export function parseScriptEntries(declaration: unknown): { entries: ScriptEntry[]; errors: string[] } {
	if (declaration === undefined) return { entries: [], errors: [] }
	if (declaration === null || typeof declaration !== 'object' || Array.isArray(declaration)) {
		return { entries: [], errors: ['scripts is not a map from output path to source — no script was compiled'] }
	}
	const entries: ScriptEntry[] = []
	const errors: string[] = []
	for (const [output, value] of Object.entries(declaration as Record<string, unknown>)) {
		const entry = parseEntry(output, value)
		if (typeof entry === 'string') errors.push(entry)
		else entries.push(entry)
	}
	const commands = new Map<string, string>()
	for (const entry of entries) {
		if (entry.command === undefined) continue
		const other = commands.get(entry.command)
		if (other !== undefined) {
			errors.push(`scripts "${other}" and "${entry.output}" both declare the command "${entry.command}"`)
		}
		commands.set(entry.command, entry.output)
	}
	return { entries, errors }
}

function parseEntry(output: string, value: unknown): ScriptEntry | string {
	const normalized = normalizeRelative(output)
	if (normalized === null) return `scripts "${output}" is not a path inside the plugin`
	if (!normalized.endsWith('.mjs')) return `scripts "${output}" must name a .mjs file`
	if (typeof value === 'string') return { output: normalized, source: value }
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return `scripts "${output}" must map to a source path or { source, command }`
	}
	const { source, command } = value as Record<string, unknown>
	if (typeof source !== 'string' || source.length === 0) return `scripts "${output}" has no source`
	if (command !== undefined && (typeof command !== 'string' || command.trim().length === 0)) {
		return `scripts "${output}" has a command that is not a command path`
	}
	return command === undefined
		? { output: normalized, source }
		: { output: normalized, source, command: command.trim().split(/\s+/).join(' ') }
}

/** A `/`-separated path relative to the plugin root, without `./`; `null` when it is absolute or
 *  climbs out of the root. */
function normalizeRelative(p: string): string | null {
	if (p.startsWith('/') || /^[a-z]:/i.test(p)) return null
	const segments: string[] = []
	for (const segment of p.split(/[\\/]/)) {
		if (segment === '' || segment === '.') continue
		if (segment !== '..') segments.push(segment)
		else if (segments.length === 0) return null
		else segments.pop()
	}
	return segments.length === 0 ? null : segments.join('/')
}

/** The command map every compiled script carries, sorted so the header is stable. */
export function commandMap(entries: ScriptEntry[]): Record<string, string> {
	const map: Record<string, string> = {}
	for (const entry of [...entries].sort((a, b) => (a.command ?? '').localeCompare(b.command ?? ''))) {
		if (entry.command !== undefined) map[entry.command] = entry.output
	}
	return map
}

/** The bin name `pnpm exec` runs: the one bin, else the bin named after the package, else the first.
 *  A string `bin` is named after the package, without its scope. */
export function binName(packageJson: Record<string, unknown> | null): string | null {
	if (packageJson === null) return null
	const name = typeof packageJson['name'] === 'string' ? packageJson['name'] : null
	const unscoped = name?.replace(/^@[^/]+\//, '') ?? null
	const bin = packageJson['bin']
	if (typeof bin === 'string') return unscoped
	if (bin === null || typeof bin !== 'object') return null
	const names = Object.keys(bin)
	if (names.length === 0) return null
	return names.find((n) => n === unscoped) ?? names[0]!
}

/** The compiled file: a hashbang when the code has one, the header, then the code. */
export function composeScript(code: string, entry: ScriptEntry, data: ScriptData): string {
	const hashbang = code.startsWith('#!') ? code.slice(0, code.indexOf('\n') + 1) : ''
	const body = hashbang ? code.slice(hashbang.length) : code
	const header = `${HEADER_PREFIX}${entry.source}. Edit the source, not this file.\n${DATA_PREFIX}${JSON.stringify(data)};\n`
	return `${hashbang}${header}${body.endsWith('\n') ? body : `${body}\n`}`
}

/** The script data a compiled file embeds; `null` when the file carries no header. */
export function embeddedData(content: string): ScriptData | null {
	for (const line of content.split('\n', 4)) {
		if (!line.startsWith(DATA_PREFIX)) continue
		try {
			return JSON.parse(line.slice(DATA_PREFIX.length).replace(/;$/, '')) as ScriptData
		} catch {
			return null
		}
	}
	return null
}

/** How the file on disk compares with the freshly compiled one.
 *
 *  - `unchanged` — identical.
 *  - `missing` — no file on disk.
 *  - `version` — only the embedded version differs. That is version drift, which `publish
 *    check-version` reports; the source is current.
 *  - `stale` — anything else differs: the source, its imports, or the command map moved on. */
export type ScriptComparison = 'unchanged' | 'missing' | 'version' | 'stale'

export function compareScript(existing: string | null, compiled: string): ScriptComparison {
	if (existing === null) return 'missing'
	if (existing === compiled) return 'unchanged'
	const expected = embeddedData(compiled)
	if (expected === null) return 'stale'
	return stampScript(existing, expected.version) === compiled ? 'version' : 'stale'
}

/** The compiled file with `version` written into its header, and nothing else changed — the stamp
 *  `plugin version` applies (#179). `null` when the file carries no header or already holds it. */
export function stampScript(content: string, version: string | null): string | null {
	const data = embeddedData(content)
	if (data === null || data.version === version) return null
	return content.replace(
		`${DATA_PREFIX}${JSON.stringify(data)};`,
		`${DATA_PREFIX}${JSON.stringify({ ...data, version })};`,
	)
}

/** A warning when a compiled script is over the budget; `null` within it. */
export function sizeWarning(output: string, bytes: number, bin: string | null): string | null {
	if (bytes <= SIZE_BUDGET_BYTES) return null
	const kb = (n: number) => `${Math.round(n / 1024)} KB`
	const call = bin === null ? 'the installed CLI' : `the installed CLI (pnpm exec ${bin}, with a pinned npx fallback)`
	return `${output} is ${kb(bytes)}, over the ${kb(SIZE_BUDGET_BYTES)} budget for a compiled skill script — have the skill call ${call} instead`
}

/** Compiles one entry into a single self-contained ES module. Implemented by an adapter (rolldown);
 *  rejects when the entry cannot be made self-contained. */
export interface ScriptCompiler {
	compile(sourcePath: string, root: string): Promise<string>
}
