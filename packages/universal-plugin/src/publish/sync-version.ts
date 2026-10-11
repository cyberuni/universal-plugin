import * as path from 'node:path'
import { type BundlePin, bundlePins } from '../bundle/bundle.js'
import { getPackagePath } from '../config/config.js'
import type { PinFs } from '../pin/fs.js'
import { applyVersionPlan } from '../version/fs.js'
import type { VersionPlan } from '../version/version.js'
import type { SyncVersionFs } from './fs.js'

export interface SyncVersionResult {
	version: string
	manifestPath: string
	/** The synced package's `name`, or `null` when its `package.json` carries none. */
	packageName: string | null
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

	const name = pkg['name']
	return { version, manifestPath, packageName: typeof name === 'string' && name.length > 0 ? name : null }
}

/** Re-pins the skills' `npx`/`upx <packageName>@<pin>` references to the synced version. The pins are
 *  derived, and `plugin bundle` owns them, so this calls bundle's own rewriter with a version source
 *  that knows only the synced package — every other package's pin is left as it is, and pin-exempt
 *  skills stay exempt. */
export function syncSkillPins(pinFs: PinFs, packageName: string, version: string): BundlePin[] {
	const source = {
		resolve: (pkg: string) =>
			pkg === packageName ? { inWorkspace: true as const, version } : { inWorkspace: false as const },
	}
	return bundlePins(pinFs, source).pins.filter((pin) => pin.package === packageName)
}
