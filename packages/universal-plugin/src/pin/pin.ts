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
 *  the plugin's version onto it". A build directive — never part of a vendor's schema, so it is
 *  stripped from everything derived. */
const PIN_MARKER = 'pinToPluginVersion'

export interface McpPinNote {
	server: string
	/** Why a marked entry could not be pinned, or was re-pinned over an authored version. */
	kind: 'not-a-runner' | 'no-manifest-version' | 'no-specifier' | 'repinned'
	/** The version the entry already carried, for `repinned`. */
	previous?: string
}

export interface McpPinResult {
	/** The servers map with every marked entry pinned and every marker stripped. */
	servers: Record<string, unknown>
	/** True when anything was pinned or a marker was stripped — i.e. the derived form differs from
	 *  the authored one and has to be delivered rather than pointed at. */
	changed: boolean
	notes: McpPinNote[]
}

/** Stamps the plugin's version onto every `mcpServers` entry that opts in with {@link PIN_MARKER},
 *  and strips the marker from all of them. Pure: the caller decides where the result is delivered.
 *
 *  Opt-in is required and a name match is never used — a plugin may publish its server under a
 *  package name that is not the plugin's, and an unrelated `npx -y widget-cli` must never be
 *  stamped with this plugin's version. */
export function pinMcpServers(servers: Record<string, unknown>, version: string | undefined): McpPinResult {
	const out: Record<string, unknown> = {}
	const notes: McpPinNote[] = []
	let changed = false

	for (const [server, rawEntry] of Object.entries(servers)) {
		if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
			out[server] = rawEntry
			continue
		}
		const { [PIN_MARKER]: marker, ...entry } = rawEntry as Record<string, unknown>
		if (marker !== undefined) changed = true
		if (marker !== true) {
			out[server] = entry
			continue
		}

		if (!version) {
			notes.push({ server, kind: 'no-manifest-version' })
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
		if (pinned.previous !== undefined && pinned.previous !== version) {
			notes.push({ server, kind: 'repinned', previous: pinned.previous })
		}
		out[server] = { ...entry, args: pinned.args }
		changed = true
	}

	return { servers: out, changed, notes }
}
