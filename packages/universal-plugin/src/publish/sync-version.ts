import * as path from 'node:path'
import { getPackagePath } from '../config/config.js'
import { applyVersionPlan } from '../version/fs.js'
import type { VersionPlan } from '../version/version.js'
import type { SyncVersionFs } from './fs.js'

export interface SyncVersionResult {
	version: string
	manifestPath: string
}

/** The changesets-driven direction of the version flow: the number is decided by
 *  `changeset version` in `<packagePath>/package.json` (the plugin root's when none is declared), and this copies it into the canonical
 *  manifest. `plugin version` is the other direction — the number decided here, flowing out to
 *  `package.json`. The two differ **only** in where the version comes from, so they share
 *  `applyVersionPlan` and cannot drift; `package.json` is the source here, never rewritten. */
export function syncVersion(root: string, syncFs: SyncVersionFs): SyncVersionResult {
	const manifestPath = path.join(root, 'plugin.json')
	if (!syncFs.exists(manifestPath)) {
		throw new Error(`No plugin.json found at ${root}`)
	}

	const agentsConfigPath = path.join(root, '.agents', 'universal-plugin.json')
	const agentsConfig = syncFs.exists(agentsConfigPath)
		? (JSON.parse(syncFs.read(agentsConfigPath)) as Record<string, unknown>)
		: {}
	// With no `packagePath`, the plugin root is the package: the usual single-package layout, where
	// `package.json` sits beside `plugin.json`. Same base directory an explicit `packagePath` resolves
	// against (#79), so `"packagePath": "."` and no key at all read the same file.
	const declared = getPackagePath(agentsConfig)
	const packagePath = declared ?? '.'

	const manifest = JSON.parse(syncFs.read(manifestPath)) as Record<string, unknown>

	const pkgJsonPath = path.join(root, packagePath, 'package.json')
	if (!syncFs.exists(pkgJsonPath)) {
		throw new Error(
			declared === null
				? 'No package.json to sync from: packagePath is not set in .agents/universal-plugin.json and the plugin root has no package.json'
				: `No package.json found at ${packagePath}`,
		)
	}

	const pkg = JSON.parse(syncFs.read(pkgJsonPath)) as Record<string, unknown>
	const version = pkg['version']
	if (!version || typeof version !== 'string') {
		throw new Error(`No version found in ${packagePath}/package.json`)
	}

	const current = manifest['version']
	const plan: VersionPlan = {
		from: typeof current === 'string' ? current : null,
		to: version,
		manifest: { ...manifest, version },
		packageJson: null,
		rows: [{ path: 'plugin.json', action: 'updated' }],
		summary: { updated: 1 },
	}
	applyVersionPlan(root, plan, syncFs)

	return { version, manifestPath }
}
