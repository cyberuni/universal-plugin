/** Pure domain for `plugin init` — scaffolding the canonical manifest and (with `--npm`)
 *  wiring an npm package to ship it.
 *
 *  No I/O: the caller gathers the current filesystem state, calls `planInit`, and applies the
 *  returned plan. `planInit` owns the rules — the guard order, the closed manifest shape, the
 *  no-`--vendor` default (omit the `vendors` key, never write `vendors: []` — `plugin build`'s
 *  `vendors ?? harnesses`-keys fallback engages only on an absent key), and the `--npm`
 *  files-wiring default (`claude-code`). The vendor→derived-manifest-path map is injected so the
 *  domain stays free of the build/registry layer. */

const SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const UP_NAMESPACE = 'org.cyberuni.universal-plugin'
const SCAFFOLD_DIRS = ['skills', 'agents', 'governances', 'commands'] as const

export interface InitOptions {
	name?: string
	/** The resolved `--vendor` list; empty when none was passed. */
	vendors: string[]
	scaffold: boolean
	force: boolean
	npm: boolean
}

export interface InitState {
	manifestExists: boolean
	/** The parsed root `package.json`, or `null` when absent. */
	packageJson: Record<string, unknown> | null
}

export interface FileRow {
	path: string
	action: 'created' | 'updated'
}

export interface InitPlan {
	manifest: Record<string, unknown>
	/** Scaffold directories to create (relative to root); empty without `--scaffold`. */
	dirs: string[]
	/** The rewritten `package.json` to write, or `null` when `--npm` was not passed. */
	packageJson: Record<string, unknown> | null
	rows: FileRow[]
	summary: { created: number; updated: number }
}

/** The closed canonical manifest init writes: `$schema` + `name`, plus the extensions namespace
 *  carrying the `vendors` list only when `--vendor` was passed. */
export function buildManifest(name: string, vendors: string[]): Record<string, unknown> {
	const manifest: Record<string, unknown> = { $schema: SCHEMA_URL, name }
	if (vendors.length > 0) {
		manifest.extensions = { [UP_NAMESPACE]: { vendors } }
	}
	return manifest
}

/** The open-standard base every published plugin ships, whatever it targets: the canonical
 *  Agent Plugins Spec manifest and the skills directory every runtime reads. Vendor-derived
 *  manifests layer on top of this — they never replace it. */
const STANDARD_FILES = ['plugin.json', 'skills/'] as const

/** Adds the open-standard base plus each derived manifest path to `package.json` `files`, creating
 *  the array when absent and never duplicating an entry. Other fields and existing entries are
 *  preserved. The base goes in regardless of `--vendor`: a package that ships only
 *  `.claude-plugin/plugin.json` has published a Claude Code plugin, not a standard one. */
export function wireFiles(pkg: Record<string, unknown>, manifestPaths: string[]): Record<string, unknown> {
	const files = Array.isArray(pkg.files) ? [...(pkg.files as unknown[])] : []
	for (const entry of [...STANDARD_FILES, ...manifestPaths]) {
		if (!files.includes(entry)) files.push(entry)
	}
	return { ...pkg, files }
}

/** Plans the init run. Throws on a guard failure (an existing manifest without `--force`; `--npm`
 *  with no `package.json`) before returning any plan, so the caller writes nothing on a guard trip. */
export function planInit(
	state: InitState,
	opts: InitOptions,
	rootDirName: string,
	resolveManifestPath: (vendor: string) => string | undefined,
): InitPlan {
	// --npm requires a package.json; the guard fires before the manifest write.
	if (opts.npm && state.packageJson === null) {
		throw new Error('error: --npm requires a package.json at the project root')
	}
	if (state.manifestExists && !opts.force) {
		throw new Error('plugin.json already exists — pass --force to overwrite')
	}

	const name = opts.name ?? rootDirName
	const manifest = buildManifest(name, opts.vendors)
	const dirs = opts.scaffold ? [...SCAFFOLD_DIRS] : []
	const rows: FileRow[] = [{ path: 'plugin.json', action: 'created' }]

	let packageJson: Record<string, unknown> | null = null
	if (opts.npm) {
		// The files-wiring default is claude-code, independent of the manifest's (omitted) vendors list.
		const wireVendors = opts.vendors.length > 0 ? opts.vendors : ['claude-code']
		const manifestPaths = wireVendors.map(resolveManifestPath).filter((p): p is string => Boolean(p))
		packageJson = wireFiles(state.packageJson as Record<string, unknown>, manifestPaths)
		rows.push({ path: 'package.json', action: 'updated' })
	}

	const created = rows.filter((r) => r.action === 'created').length
	const updated = rows.filter((r) => r.action === 'updated').length
	return { manifest, dirs, packageJson, rows, summary: { created, updated } }
}
