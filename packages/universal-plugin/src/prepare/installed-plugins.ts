/** One plugin a harness has installed, as `prepare` needs it. */
export interface InstalledPlugin {
	name: string
	version: string
	/** Absolute path to the installed plugin's root. */
	root: string
}

export interface InstallScope {
	scope: 'global' | 'project'
	/** The project root, for `project` scope. */
	projectRoot?: string
}

/**
 * Reads Claude Code's `installed_plugins.json` (version 2): `plugins` maps `<plugin>@<marketplace>`
 * to one entry per install, each with a `scope`, `installPath`, `version`, and, for project
 * installs, `projectPath`. Global scope takes the `user` installs; project scope takes the installs
 * whose `projectPath` is the project root.
 */
export function parseClaudeInstallRecord(raw: unknown, { scope, projectRoot }: InstallScope): InstalledPlugin[] {
	const plugins = isRecord(raw) && isRecord(raw['plugins']) ? raw['plugins'] : {}
	const result: InstalledPlugin[] = []
	for (const [key, entries] of Object.entries(plugins)) {
		if (!Array.isArray(entries)) continue
		const entry = entries
			.filter(isRecord)
			.find((e) => (scope === 'global' ? e['scope'] === 'user' : e['projectPath'] === projectRoot))
		if (!entry || typeof entry['installPath'] !== 'string') continue
		result.push({
			name: pluginName(key),
			version: typeof entry['version'] === 'string' ? entry['version'] : 'unknown',
			root: entry['installPath'],
		})
	}
	return result
}

/** Strips the `@<marketplace>` suffix from a `<plugin>@<marketplace>` key. */
export function pluginName(key: string): string {
	const at = key.lastIndexOf('@')
	return at > 0 ? key.slice(0, at) : key
}

/**
 * Picks the newest of a plugin's cached version folders. Dotted numeric versions compare
 * numerically, part by part; anything else falls back to string order.
 */
export function latestVersion(versions: string[]): string | undefined {
	return [...versions].sort(compareVersions).at(-1)
}

function compareVersions(a: string, b: string): number {
	const pa = a.split(/[.+-]/)
	const pb = b.split(/[.+-]/)
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const x = pa[i] ?? ''
		const y = pb[i] ?? ''
		if (x === y) continue
		const nx = Number(x)
		const ny = Number(y)
		if (x !== '' && y !== '' && Number.isInteger(nx) && Number.isInteger(ny)) return nx - ny
		return x < y ? -1 : 1
	}
	return 0
}

/** Maps installed plugins to the name → version record `prepare` snapshots. */
export function toVersions(plugins: InstalledPlugin[]): Record<string, string> {
	return Object.fromEntries(plugins.map((p) => [p.name, p.version]))
}

/** Maps installed plugins to name → root, with the home directory written as `~`. */
export function toRoots(plugins: InstalledPlugin[], home: string): Record<string, string> {
	return Object.fromEntries(
		plugins.map((p) => [p.name, p.root.startsWith(home) ? '~' + p.root.slice(home.length) : p.root]),
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
