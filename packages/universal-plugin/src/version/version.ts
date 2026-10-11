/** Pure domain for `plugin version` — the one command that stamps a plugin's version.
 *
 *  No I/O: the caller gathers the current filesystem state, calls `planVersion`, and applies the
 *  returned plan. `planVersion` owns the rules — where the number comes from (a release type, an
 *  explicit version, or the package's `package.json`), the guard order (every guard resolves before
 *  the first write, so a failing run leaves the tree untouched), and the stamp itself.
 *
 *  The seam is derive vs stamp (#179). `plugin build` derives each runtime's files from source and
 *  never decides a version. This command takes a known version and writes it into every place that
 *  carries one: the canonical `plugin.json`, the `packagePath` `package.json`, the `npx`/`upx` pins in
 *  the skills' files (Markdown and scripts alike), the version each compiled skill script embeds
 *  (#177), `.plugin/pins.json`, and each authored `mcpServers` entry marked `pinToPluginVersion`. The per-vendor manifests and the repository catalogs are then
 *  re-derived by calling `plugin build`, which owns them. */

import * as semver from 'semver'

import { UP_NAMESPACE } from '../build/build.js'
import { embeddedData, stampScript } from '../compile/scripts.js'
import { type McpPinNote, stampMcpServers } from '../pin/pin.js'
import { type StampedPin, stampPins } from '../pin/stamp.js'

export const RELEASE_TYPES = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'] as const

type ReleaseType = (typeof RELEASE_TYPES)[number]

function isReleaseType(value: string): value is ReleaseType {
	return (RELEASE_TYPES as readonly string[]).includes(value)
}

/** The version `package.json` holds until semantic-release writes the real one inside its publish
 *  run. A place carrying it has not been stamped yet; it is not a version that drifted. */
export const UNSTAMPED_VERSION = '0.0.0-development'

export interface VersionOptions {
	/** A release type (`patch`) or an explicit version (`1.4.0`). Omitted with `fromPackage`. */
	bump?: string
	/** Take the version the package's `package.json` already holds — the release tool moved it. */
	fromPackage?: boolean
	/** Prerelease identifier for the `pre*` release types. */
	preid?: string
	/** Allow a target that does not advance on the current version. */
	force: boolean
}

/** A text file and its path relative to the plugin root. */
interface StampFile {
	path: string
	content: string
}

/** A JSON file, parsed, and its path relative to the plugin root. */
export interface StampJson {
	path: string
	content: Record<string, unknown>
}

export interface VersionState {
	manifestExists: boolean
	/** The parsed canonical `plugin.json`, or `null` when absent. */
	manifest: Record<string, unknown> | null
	/** `packagePath` from `.agents/universal-plugin.json`, or `null` when the project declares none. */
	packagePath: string | null
	/** The parsed `package.json` at `packagePath`, or `null` when that file is absent. */
	packageJson: Record<string, unknown> | null
	/** The `package.json` beside `plugin.json`, read when no `packagePath` is declared: the plugin root
	 *  is then the package, for `--from-package` and for naming the plugin's own pins. */
	rootPackageJson?: Record<string, unknown> | null
	/** Every text file under the plugin's skills directory, scripts included. */
	skillFiles?: StampFile[]
	/** The workspace members' `package.json` versions, by package name, for the pins of a workspace
	 *  CLI other than the plugin's own. `undefined` is a member whose version could not be read. */
	workspace?: Record<string, string | undefined>
	/** The authored `mcpServers` files a path declaration (or the spec-fixed `mcp.json`) names. */
	mcpFiles?: StampJson[]
	/** Whether `.plugin/pins.json` already exists. */
	pinsMapExists?: boolean
}

/** `updated` is an authored number moved; `stamped` is a place the number was written into. */
interface FileRow {
	path: string
	action: 'updated' | 'stamped'
}

export interface VersionPlan {
	/** The manifest's version before the move; `null` when it carried none. */
	from: string | null
	to: string
	manifest: Record<string, unknown>
	/** The rewritten `package.json` and its root-relative path; `null` when no package is written
	 *  (none declared, or `--from-package` read the number from it). */
	packageJson: { path: string; content: Record<string, unknown> } | null
	/** Skill files whose pins moved, and compiled skill scripts whose embedded version moved. */
	files: StampFile[]
	/** Authored `mcpServers` files whose marked entries moved, and `.plugin/pins.json`. */
	json: StampJson[]
	/** The skills' pins, as the stamp resolved them. */
	pins: StampedPin[]
	warnings: string[]
	rows: FileRow[]
	summary: { updated: number; stamped: number }
}

/** Where the plugin's `.plugin/pins.json` map lives, relative to the plugin root. */
export const PINS_MAP_PATH = '.plugin/pins.json'

/** Reads the canonical manifest's current version, or `null` when it carries none. */
export function currentVersion(manifest: Record<string, unknown> | null): string | null {
	const version = manifest?.['version']
	return typeof version === 'string' && version.length > 0 ? version : null
}

/** Resolves the bump argument against the current version. An explicit version is used as given;
 *  a release type is applied to the current one, which must therefore exist. */
export function resolveTarget(current: string | null, opts: VersionOptions & { bump: string }): string {
	if (semver.valid(opts.bump)) return semver.valid(opts.bump) as string

	if (!isReleaseType(opts.bump)) {
		throw new Error(
			`Unknown version or release type "${opts.bump}" — expected an explicit version (1.4.0) or one of: ${RELEASE_TYPES.join(', ')}`,
		)
	}

	if (current === null) {
		throw new Error(
			'plugin.json has no version to bump from — pass an explicit version (e.g. 0.1.0) to set the first one',
		)
	}

	const next = opts.preid === undefined ? semver.inc(current, opts.bump) : semver.inc(current, opts.bump, opts.preid)
	if (next === null) {
		throw new Error(`Current version "${current}" in plugin.json is not valid semver`)
	}
	return next
}

/** The package `--from-package` reads and whose name the plugin's own pins carry: the declared
 *  `packagePath`, else the plugin root. */
function ownPackage(state: VersionState): { path: string; json: Record<string, unknown> | null } {
	if (state.packagePath !== null) {
		return { path: joinRelative(state.packagePath, 'package.json'), json: state.packageJson }
	}
	return { path: 'package.json', json: state.rootPackageJson ?? null }
}

/** Reads the version a release tool already wrote into the package. */
function versionFromPackage(state: VersionState): string {
	const pkg = ownPackage(state)
	if (pkg.json === null) {
		throw new Error(
			state.packagePath === null
				? 'No package.json to read the version from: packagePath is not set in .agents/universal-plugin.json and the plugin root has no package.json'
				: `No package.json found at packagePath "${state.packagePath}"`,
		)
	}
	const version = pkg.json['version']
	if (typeof version !== 'string' || version.length === 0) {
		throw new Error(`No version found in ${pkg.path}`)
	}
	if (version === UNSTAMPED_VERSION) {
		throw new Error(
			`${pkg.path} holds the placeholder ${UNSTAMPED_VERSION} — pass the release's version explicitly (plugin version \${nextRelease.version})`,
		)
	}
	const valid = semver.valid(version)
	if (valid === null) throw new Error(`Version "${version}" in ${pkg.path} is not valid semver`)
	return valid
}

/** Picks the number. Exactly one source: a bump argument or `--from-package`. Under ADR-0010 §2 a
 *  plugin with `packagePath` gets its number from the package, so a release type there is refused —
 *  the explicit and `--from-package` forms stay, because release tools call them. */
function resolveVersion(state: VersionState, from: string | null, opts: VersionOptions): string {
	if (opts.fromPackage) {
		if (opts.bump !== undefined) {
			throw new Error(`Pass a version or --from-package, not both (got "${opts.bump}")`)
		}
		return versionFromPackage(state)
	}
	if (opts.bump === undefined) {
		throw new Error(`Pass a release type (${RELEASE_TYPES.join(', ')}), an explicit version, or --from-package`)
	}
	if (state.packagePath !== null && isReleaseType(opts.bump)) {
		const pkg = joinRelative(state.packagePath, 'package.json')
		throw new Error(
			`packagePath is declared, so the release picks the number — bump ${pkg} with your release tool (e.g. changeset version), then run plugin version --from-package`,
		)
	}
	const to = resolveTarget(from, { ...opts, bump: opts.bump })
	if (from !== null && from !== UNSTAMPED_VERSION && !semver.gt(to, from) && !opts.force) {
		throw new Error(
			`Target version "${to}" does not advance on the current version "${from}" — pass --force to set it anyway`,
		)
	}
	return to
}

/** The authored `mcpServers` servers map inside a declaration or file, and how to put a rewritten
 *  one back. A `{ "mcpServers": {...} }` wrapper and a bare servers map are both accepted, as the
 *  build reads them. */
function serversOf(block: Record<string, unknown>): {
	servers: Record<string, unknown>
	put: (servers: Record<string, unknown>) => Record<string, unknown>
} {
	const inner = block['mcpServers']
	if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
		return { servers: inner as Record<string, unknown>, put: (servers) => ({ ...block, mcpServers: servers }) }
	}
	return { servers: block, put: (servers) => servers }
}

/** Stamps the inline `mcpServers` declaration in the canonical manifest, when it carries one. */
function stampInlineMcp(
	manifest: Record<string, unknown>,
	to: string,
	notes: McpPinNote[],
): { manifest: Record<string, unknown>; changed: boolean } {
	const extensions = manifest['extensions'] as Record<string, unknown> | undefined
	const uext = extensions?.[UP_NAMESPACE] as Record<string, unknown> | undefined
	const declaration = uext?.['mcpServers']
	if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) return { manifest, changed: false }
	if (Array.isArray((declaration as Record<string, unknown>)['paths'])) return { manifest, changed: false }
	const { servers, put } = serversOf(declaration as Record<string, unknown>)
	const stamped = stampMcpServers(servers, to)
	notes.push(...stamped.notes)
	if (!stamped.changed) return { manifest, changed: false }
	return {
		manifest: {
			...manifest,
			extensions: { ...extensions, [UP_NAMESPACE]: { ...uext, mcpServers: put(stamped.servers) } },
		},
		changed: true,
	}
}

/** Stamps the skills' `npx`/`upx` pins: the plugin's own package to the new version, every other
 *  workspace CLI to its workspace version, anything else left as it is. Pin-exempt skills stay
 *  exempt. */
function stampSkillPins(
	state: VersionState,
	to: string,
): { files: StampFile[]; pins: StampedPin[]; warnings: string[] } {
	// A compiled script is stamped through its header (`stampCompiledScripts`). A pin its inlined code
	// carries is the source's, and rewriting it would leave the script behind its source.
	const contents = new Map(
		(state.skillFiles ?? []).filter((f) => embeddedData(f.content) === null).map((f) => [f.path, f.content]),
	)
	const written = new Map<string, string>()
	const ownName = ownPackage(state).json?.['name']
	const workspace = state.workspace ?? {}
	const result = stampPins(
		{
			listSkillFiles: () => [...contents.keys()],
			readFile: (p) => contents.get(p) as string,
			writeFile: (p, c) => {
				written.set(p, c)
			},
		},
		{
			resolve(pkg) {
				if (typeof ownName === 'string' && pkg === ownName) return { inWorkspace: true, version: to }
				if (!Object.hasOwn(workspace, pkg)) return { inWorkspace: false }
				return { inWorkspace: true, version: workspace[pkg] }
			},
		},
	)
	return {
		files: [...written].map(([path, content]) => ({ path, content })),
		pins: result.pins,
		warnings: result.warnings,
	}
}

/** Stamps the version each compiled skill script embeds (#177). Only the header moves; the compiled
 *  code is the build's, and a script behind its source is `plugin build`'s to re-derive. */
function stampCompiledScripts(state: VersionState, to: string): StampFile[] {
	const files: StampFile[] = []
	for (const file of state.skillFiles ?? []) {
		const stamped = stampScript(file.content, to)
		if (stamped !== null) files.push({ path: file.path, content: stamped })
	}
	return files
}

/** The flat, key-sorted `{ "<package>": "<version>" }` map of the pins the stamp resolved, so a
 *  skill can read the shipped version programmatically. External pins are left out — they have no
 *  version this repository decides. */
export function pinsMap(pins: StampedPin[]): Record<string, string> {
	const map: Record<string, string> = {}
	for (const pin of [...pins].sort((a, b) => a.package.localeCompare(b.package))) {
		if (pin.status === 'pinned' || pin.status === 'unchanged') map[pin.package] = pin.resolved
	}
	return map
}

function formatMcpNote(note: McpPinNote): string {
	return note.kind === 'not-a-runner'
		? `mcpServers "${note.server}" asks to be pinned to the plugin version, but its command is not "npx" or "upx" — left unpinned`
		: `mcpServers "${note.server}" asks to be pinned to the plugin version, but its args carry no package specifier — left unpinned`
}

/** Plans the version move. Throws on any guard failure before returning a plan, so the caller
 *  writes nothing on a guard trip. */
export function planVersion(state: VersionState, opts: VersionOptions): VersionPlan {
	if (!state.manifestExists || state.manifest === null) {
		throw new Error('No plugin.json found at the project root')
	}

	// A declared path whose package.json is missing is a misconfiguration, not an opt-out — fail
	// rather than silently stamp half the places.
	if (state.packagePath !== null && state.packageJson === null) {
		throw new Error(`No package.json found at packagePath "${state.packagePath}"`)
	}

	const from = currentVersion(state.manifest)
	const to = resolveVersion(state, from, opts)

	const rows: FileRow[] = [{ path: 'plugin.json', action: 'updated' }]
	let packageJson: VersionPlan['packageJson'] = null
	// `--from-package` read the number from the package, so the package is the source, never rewritten.
	if (!opts.fromPackage && state.packagePath !== null && state.packageJson !== null) {
		const relPath = joinRelative(state.packagePath, 'package.json')
		packageJson = { path: relPath, content: { ...state.packageJson, version: to } }
		rows.push({ path: relPath, action: 'updated' })
	}

	const notes: McpPinNote[] = []
	const inline = stampInlineMcp({ ...state.manifest, version: to }, to, notes)

	const json: StampJson[] = []
	for (const file of state.mcpFiles ?? []) {
		const { servers, put } = serversOf(file.content)
		const stamped = stampMcpServers(servers, to)
		notes.push(...stamped.notes)
		if (stamped.changed) json.push({ path: file.path, content: put(stamped.servers) })
	}

	const skills = stampSkillPins(state, to)
	const map = pinsMap(skills.pins)
	// A plugin whose skills pin nothing this repository versions gets no map — unless it already had one.
	if (Object.keys(map).length > 0 || state.pinsMapExists) json.push({ path: PINS_MAP_PATH, content: map })

	const files = [...skills.files, ...stampCompiledScripts(state, to)]
	for (const file of files) rows.push({ path: file.path, action: 'stamped' })
	for (const file of json) rows.push({ path: file.path, action: 'stamped' })

	return {
		from,
		to,
		manifest: inline.manifest,
		packageJson,
		files,
		json,
		pins: skills.pins,
		warnings: [...notes.map(formatMcpNote), ...skills.warnings],
		rows,
		summary: {
			updated: rows.filter((r) => r.action === 'updated').length,
			stamped: rows.filter((r) => r.action === 'stamped').length,
		},
	}
}

/** Root-relative POSIX join — the domain reports paths as the user typed `packagePath`, so the
 *  result stays stable across platforms and readable in the TOON output. */
export function joinRelative(dir: string, file: string): string {
	const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '')
	return normalized === '' || normalized === '.' ? file : `${normalized}/${file}`
}
