/** Pure domain for `plugin version` — moving a plugin's version.
 *
 *  No I/O: the caller gathers the current filesystem state, calls `planVersion`, and applies the
 *  returned plan. `planVersion` owns the rules — the guard order (every guard resolves before the
 *  first write, so a failing run leaves the tree untouched), the bump arithmetic, and the fact that
 *  only the **authored** files are planned.
 *
 *  A version lives in five places, but only two are authored: the canonical `plugin.json` and, when
 *  the project declares a `packagePath`, that `package.json`. The per-vendor manifests
 *  (`plugin build`), the local marketplace catalogs (`marketplace init`), and the `npx`/`upx`
 *  pins in `skills/**` (`plugin bundle`) are all **derived** — re-derived by calling the command
 *  that owns them, never written a second time here. */

import * as semver from 'semver'

export const RELEASE_TYPES = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'] as const

type ReleaseType = (typeof RELEASE_TYPES)[number]

function isReleaseType(value: string): value is ReleaseType {
	return (RELEASE_TYPES as readonly string[]).includes(value)
}

export interface VersionOptions {
	/** A release type (`patch`) or an explicit version (`1.4.0`). */
	bump: string
	/** Prerelease identifier for the `pre*` release types. */
	preid?: string
	/** Allow a target that does not advance on the current version. */
	force: boolean
}

export interface VersionState {
	manifestExists: boolean
	/** The parsed canonical `plugin.json`, or `null` when absent. */
	manifest: Record<string, unknown> | null
	/** `packagePath` from `.agents/universal-plugin.json`, or `null` when the project declares none. */
	packagePath: string | null
	/** The parsed `package.json` at `packagePath`, or `null` when that file is absent. */
	packageJson: Record<string, unknown> | null
}

interface FileRow {
	path: string
	action: 'updated'
}

export interface VersionPlan {
	/** The manifest's version before the bump; `null` when it carried none. */
	from: string | null
	to: string
	manifest: Record<string, unknown>
	/** The rewritten `package.json` and its root-relative path, or `null` with no `packagePath`. */
	packageJson: { path: string; content: Record<string, unknown> } | null
	rows: FileRow[]
	summary: { updated: number }
}

/** Reads the canonical manifest's current version, or `null` when it carries none. */
export function currentVersion(manifest: Record<string, unknown> | null): string | null {
	const version = manifest?.['version']
	return typeof version === 'string' && version.length > 0 ? version : null
}

/** Resolves the bump argument against the current version. An explicit version is used as given;
 *  a release type is applied to the current one, which must therefore exist. */
export function resolveTarget(current: string | null, opts: VersionOptions): string {
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

/** Plans the version move. Throws on any guard failure before returning a plan, so the caller
 *  writes nothing on a guard trip. */
export function planVersion(state: VersionState, opts: VersionOptions): VersionPlan {
	if (!state.manifestExists || state.manifest === null) {
		throw new Error('No plugin.json found at the project root')
	}

	const from = currentVersion(state.manifest)
	const to = resolveTarget(from, opts)

	if (from !== null && !semver.gt(to, from) && !opts.force) {
		throw new Error(
			`Target version "${to}" does not advance on the current version "${from}" — pass --force to set it anyway`,
		)
	}

	// The npm half is planned only when the project declares one. A declared path whose package.json
	// is missing is a misconfiguration, not an opt-out — fail rather than silently bump half the pair.
	if (state.packagePath !== null && state.packageJson === null) {
		throw new Error(`No package.json found at packagePath "${state.packagePath}"`)
	}

	const rows: FileRow[] = [{ path: 'plugin.json', action: 'updated' }]
	let packageJson: VersionPlan['packageJson'] = null
	if (state.packagePath !== null && state.packageJson !== null) {
		const relPath = joinRelative(state.packagePath, 'package.json')
		packageJson = { path: relPath, content: { ...state.packageJson, version: to } }
		rows.push({ path: relPath, action: 'updated' })
	}

	return {
		from,
		to,
		manifest: { ...state.manifest, version: to },
		packageJson,
		rows,
		summary: { updated: rows.length },
	}
}

/** Root-relative POSIX join — the domain reports paths as the user typed `packagePath`, so the
 *  result stays stable across platforms and readable in the TOON output. */
function joinRelative(dir: string, file: string): string {
	const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '')
	return normalized === '' || normalized === '.' ? file : `${normalized}/${file}`
}
