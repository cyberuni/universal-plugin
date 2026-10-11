/** Version drift — does every file that carries the plugin's version say the same number?
 *
 *  No I/O: the caller gathers the files (`gatherDriftState`) and this reads the version out of each.
 *  A version lives in five places (see `version.ts`). The reference is the authored number the
 *  release decides: the `packagePath` `package.json` when the project declares one (changesets,
 *  release-please or semantic-release moved it), else the canonical `plugin.json`. Every other place
 *  is compared against it, so a release that moved one number and left the rest behind is caught on
 *  the release PR rather than after publish (issue #164). */

import * as semver from 'semver'

import { isPinExempt } from '../bundle/bundle.js'
import { extractPins } from '../pin/pin.js'
import { currentVersion, joinRelative } from './version.js'

export type DriftKind = 'package' | 'manifest' | 'vendor-manifest' | 'catalog' | 'skill-pin'

/** One file and the version it carries. `version` is `null` only for the canonical manifest, which
 *  drifts by carrying no version at all while the package it ships in has one. */
export interface VersionSurface {
	path: string
	kind: DriftKind
	version: string | null
}

/** A file's text and its path relative to the plugin root. */
export interface DriftFile {
	path: string
	content: string
}

export interface DriftState {
	manifest: Record<string, unknown>
	/** `packagePath` from `.agents/universal-plugin.json`, or `null` when the project declares none. */
	packagePath: string | null
	/** The parsed `package.json` at `packagePath`, or `null` when that file is absent. */
	packageJson: Record<string, unknown> | null
	/** The derived manifests of the declared vendors that exist on disk. */
	vendorManifests: DriftFile[]
	/** The marketplace catalogs the repository carries. */
	catalogs: DriftFile[]
	/** Every text file under the plugin's skills directory. */
	skillFiles: DriftFile[]
}

export interface DriftResult {
	/** The version every file should carry; `null` when no authored file carries one. */
	expected: string | null
	/** The file `expected` was read from. */
	source: string
	/** Every file compared, the source included. */
	surfaces: VersionSurface[]
	/** The files that disagree with `expected`. */
	drifted: VersionSurface[]
}

export function checkVersionDrift(state: DriftState): DriftResult {
	// A declared package that is missing is a misconfiguration, the same guard `plugin version` trips.
	if (state.packagePath !== null && state.packageJson === null) {
		throw new Error(`No package.json found at packagePath "${state.packagePath}"`)
	}

	const surfaces: VersionSurface[] = []
	const manifestSurface: VersionSurface = {
		path: 'plugin.json',
		kind: 'manifest',
		version: currentVersion(state.manifest),
	}
	let packageSurface: VersionSurface | null = null
	if (state.packagePath !== null && state.packageJson !== null) {
		packageSurface = {
			path: joinRelative(state.packagePath, 'package.json'),
			kind: 'package',
			version: stringField(state.packageJson, 'version'),
		}
		surfaces.push(packageSurface)
	}
	surfaces.push(manifestSurface)

	for (const file of state.vendorManifests) {
		const version = stringField(parse(file.content), 'version')
		if (version !== null) surfaces.push({ path: file.path, kind: 'vendor-manifest', version })
	}

	const name = stringField(state.manifest, 'name')
	for (const file of state.catalogs) {
		const version = catalogEntryVersion(file.content, name)
		if (version !== null) surfaces.push({ path: file.path, kind: 'catalog', version })
	}

	// A skill pins the npm package that ships the plugin, so there is nothing to compare without one.
	const packageName = state.packageJson === null ? null : stringField(state.packageJson, 'name')
	if (packageName !== null) surfaces.push(...skillPins(state.skillFiles, packageName))

	const reference = packageSurface?.version ? packageSurface : manifestSurface
	const expected = reference.version
	const drifted = expected === null ? [] : surfaces.filter((s) => s !== reference && s.version !== expected)
	return { expected, source: reference.path, surfaces, drifted }
}

/** The plugin's own pins: `npx`/`upx <package>@<version>` references to the package that ships it.
 *  A pin-exempt skill is skipped as `plugin bundle` skips it, and so is a pin that is not a version
 *  (`<version>`, `latest`, a range) — that is a placeholder or a choice, not a number left behind. */
function skillPins(files: DriftFile[], packageName: string): VersionSurface[] {
	const exemptDirs = files
		.filter((f) => /(^|\/)SKILL\.md$/.test(f.path) && isPinExempt(f.content))
		.map((f) => f.path.slice(0, f.path.lastIndexOf('/') + 1))
	const pins: VersionSurface[] = []
	for (const file of files) {
		if (exemptDirs.some((dir) => file.path.startsWith(dir))) continue
		const versions = new Set(
			extractPins(file.content)
				.filter((pin) => pin.pkg === packageName && semver.valid(pin.current) !== null)
				.map((pin) => pin.current),
		)
		for (const version of versions) pins.push({ path: file.path, kind: 'skill-pin', version })
	}
	return pins
}

/** The version a catalog's entry for this plugin carries; `null` when it lists no such entry or the
 *  entry carries no version. */
function catalogEntryVersion(content: string, name: string | null): string | null {
	const plugins = parse(content)?.['plugins']
	if (name === null || !Array.isArray(plugins)) return null
	const entry = plugins.find(
		(candidate): candidate is Record<string, unknown> =>
			typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>).name === name,
	)
	return entry === undefined ? null : stringField(entry, 'version')
}

function parse(content: string): Record<string, unknown> | null {
	try {
		const value = JSON.parse(content) as unknown
		return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
	} catch {
		return null
	}
}

function stringField(value: Record<string, unknown> | null, key: string): string | null {
	const field = value?.[key]
	return typeof field === 'string' && field.length > 0 ? field : null
}
