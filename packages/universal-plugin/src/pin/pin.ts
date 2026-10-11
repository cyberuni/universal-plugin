/** A `npx <pkg>@<pin>` or `upx <pkg>@<pin>` reference detected in a skill file. */
export interface Pin {
	pkg: string
	current: string
	file: string
	/** Which runner word this reference used — `npx` or `upx`. */
	runner: 'npx' | 'upx'
}

/** The words that mean "fetch and run this package". Stated once: the skill-prose matcher below and
 *  the argv matcher used for `mcpServers` invocations must agree on what a runner is. */
const RUNNERS = 'npx|upx'
/** The `-y` spelling is the one ad-hoc regexes miss, so it lives here with `--yes` rather than in
 *  each caller. */
const RUNNER_FLAG = '--yes|-y'
/** Characters a package specifier may carry, scope included. */
const PACKAGE_CHARS = '@a-z0-9/._-'

const PIN_PATTERN = new RegExp(`(${RUNNERS})\\s+(?:(?:${RUNNER_FLAG})\\s+)?([${PACKAGE_CHARS}]+)@(\\S+)`, 'g')
const RUNNER_WORD = new RegExp(`^(?:${RUNNERS})$`)
const RUNNER_FLAG_ARG = new RegExp(`^(?:${RUNNER_FLAG})$`)
const PACKAGE_TOKEN = new RegExp(`^[${PACKAGE_CHARS}]+$`)

/** Strips a trailing backtick, quote, or paren that isn't part of the version token. */
function stripTrailing(raw: string): string {
	return raw.replace(/[`'")]+$/, '')
}

export function extractPins(text: string): Pin[] {
	const pins: Pin[] = []
	for (const match of text.matchAll(PIN_PATTERN)) {
		const runner = match[1]
		const pkg = match[2]
		const current = match[3]
		if (!runner || !pkg || !current) continue
		pins.push({ pkg, current: stripTrailing(current), file: '', runner: runner as 'npx' | 'upx' })
	}
	return pins
}

/** True when `command` invokes a package runner, and so carries a package specifier in its argv. */
export function isPackageRunner(command: unknown): boolean {
	return typeof command === 'string' && RUNNER_WORD.test(command)
}

/** Splits a package specifier token into its name and, when present, its version. A leading `@` is
 *  the scope separator, never the version one. */
export function splitSpecifier(token: string): { pkg: string; version?: string } {
	const at = token.lastIndexOf('@')
	if (at <= 0) return { pkg: token }
	return { pkg: token.slice(0, at), version: token.slice(at + 1) }
}

export interface PinnedArgs {
	args: unknown[]
	pkg: string
	/** The version the argv already carried, when it carried one. */
	previous?: string
}

/** Rewrites the package specifier in a runner's argv to `<pkg>@<version>`. The specifier is the
 *  first argument that is not a runner flag. Returns null when the argv carries none. Every other
 *  argument is carried through exactly as authored — this rewrites one slot, not the argv. */
export function pinRunnerArgs(args: readonly unknown[], version: string): PinnedArgs | null {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (typeof arg !== 'string') continue
		if (RUNNER_FLAG_ARG.test(arg)) continue
		if (!PACKAGE_TOKEN.test(arg)) return null
		const { pkg, version: previous } = splitSpecifier(arg)
		const next = [...args]
		next[i] = `${pkg}@${version}`
		return previous === undefined ? { args: next, pkg } : { args: next, pkg, previous }
	}
	return null
}

/** The canonical opt-in marker on an `mcpServers` entry: "this package is the plugin's own, stamp
 *  the plugin's version onto it". It stays on the authored entry, so the next `plugin version` finds
 *  it again, and is stripped from everything derived — it is never part of a vendor's schema. */
const PIN_MARKER = 'pinToPluginVersion'

export interface McpPinNote {
	server: string
	/** Why a marked entry could not be stamped. */
	kind: 'not-a-runner' | 'no-specifier'
}

export interface McpStampResult {
	/** The servers map with every marked entry stamped; the markers stay. */
	servers: Record<string, unknown>
	/** True when any entry's specifier moved. */
	changed: boolean
	notes: McpPinNote[]
}

function isEntry(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Stamps `version` onto every authored `mcpServers` entry that opts in with {@link PIN_MARKER}.
 *  Pure: the caller decides where the result is written.
 *
 *  Opt-in is required and a name match is never used — a plugin may publish its server under a
 *  package name that is not the plugin's, and an unrelated `npx -y widget-cli` must never be
 *  stamped with this plugin's version. */
export function stampMcpServers(servers: Record<string, unknown>, version: string): McpStampResult {
	const out: Record<string, unknown> = {}
	const notes: McpPinNote[] = []
	let changed = false

	for (const [server, entry] of Object.entries(servers)) {
		if (!isEntry(entry) || entry[PIN_MARKER] !== true) {
			out[server] = entry
			continue
		}
		if (!isPackageRunner(entry['command'])) {
			notes.push({ server, kind: 'not-a-runner' })
			out[server] = entry
			continue
		}
		const args = entry['args']
		const pinned = Array.isArray(args) ? pinRunnerArgs(args, version) : null
		if (!pinned) {
			notes.push({ server, kind: 'no-specifier' })
			out[server] = entry
			continue
		}
		if (pinned.previous !== version) changed = true
		out[server] = { ...entry, args: pinned.args }
	}

	return { servers: out, changed, notes }
}

/** The plugin's version as each marked `mcpServers` entry carries it, for the drift check. An entry
 *  whose specifier carries no version is listed with `undefined`. */
export function markedMcpVersions(servers: Record<string, unknown>): { server: string; version?: string }[] {
	const found: { server: string; version?: string }[] = []
	for (const [server, entry] of Object.entries(servers)) {
		if (!isEntry(entry) || entry[PIN_MARKER] !== true || !isPackageRunner(entry['command'])) continue
		const args = entry['args']
		const pinned = Array.isArray(args) ? pinRunnerArgs(args, '') : null
		if (pinned) found.push(pinned.previous === undefined ? { server } : { server, version: pinned.previous })
	}
	return found
}

export interface McpStripResult {
	servers: Record<string, unknown>
	/** True when a marker was stripped — the derived form then differs from the authored one and has
	 *  to be delivered rather than pointed at. */
	changed: boolean
}

/** Strips {@link PIN_MARKER} from every entry, for the derived manifests. The version the entry
 *  carries is copied as authored: `plugin version` stamped it, and a build never decides one. */
export function stripPinMarkers(servers: Record<string, unknown>): McpStripResult {
	const out: Record<string, unknown> = {}
	let changed = false
	for (const [server, entry] of Object.entries(servers)) {
		if (!isEntry(entry) || !(PIN_MARKER in entry)) {
			out[server] = entry
			continue
		}
		const { [PIN_MARKER]: _marker, ...rest } = entry
		out[server] = rest
		changed = true
	}
	return { servers: out, changed }
}
