import * as fs from 'node:fs'
import * as path from 'node:path'

import { detectIndent } from '../json.js'
import type { VersionPlan, VersionState } from './version.js'

/** Minimal JSON file access. `applyVersionPlan` is written against this rather than `node:fs` so
 *  both directions of the version flow — `plugin version` (computed here) and `publish sync-version`
 *  (decided by changesets) — share the **one** applier and cannot drift apart. */
export interface JsonIo {
	exists(filePath: string): boolean
	read(filePath: string): string
	write(filePath: string, content: string): void
}

export const realJsonIo: JsonIo = {
	exists: (p) => fs.existsSync(p),
	read: (p) => fs.readFileSync(p, 'utf8'),
	write: (p, content) => fs.writeFileSync(p, content),
}

export interface VersionFs {
	gather(root: string): VersionState
	apply(root: string, plan: VersionPlan): void
}

/** Reads `packagePath` from `.agents/universal-plugin.json`. Absent file, absent key, or a
 *  non-string value all mean "this plugin declares no npm package" — the manifest is then the only
 *  authored file. (A *declared* path whose `package.json` is missing is a different case, and the
 *  domain rejects it.) */
function readPackagePath(root: string, io: JsonIo): string | null {
	const configPath = path.join(root, '.agents', 'universal-plugin.json')
	if (!io.exists(configPath)) return null
	const config = JSON.parse(io.read(configPath)) as Record<string, unknown>
	const packagePath = config['packagePath']
	return typeof packagePath === 'string' && packagePath.length > 0 ? packagePath : null
}

/** Writes `value` over `filePath`, keeping whatever indentation that file already used. */
function writeJson(io: JsonIo, filePath: string, value: unknown): void {
	const indent = io.exists(filePath) ? detectIndent(io.read(filePath)) : '\t'
	io.write(filePath, `${JSON.stringify(value, null, indent)}\n`)
}

/** The one applier. Writes every authored file the plan names — and nothing else: the derived
 *  vendor manifests are re-derived by calling `plugin build`, which owns them. */
export function applyVersionPlan(root: string, plan: VersionPlan, io: JsonIo): void {
	writeJson(io, path.join(root, 'plugin.json'), plan.manifest)
	if (plan.packageJson) {
		writeJson(io, path.join(root, plan.packageJson.path), plan.packageJson.content)
	}
}

export const realVersionFs: VersionFs = {
	gather(root) {
		const manifestPath = path.join(root, 'plugin.json')
		const manifestExists = realJsonIo.exists(manifestPath)
		const manifest = manifestExists ? (JSON.parse(realJsonIo.read(manifestPath)) as Record<string, unknown>) : null

		const packagePath = readPackagePath(root, realJsonIo)
		const pkgJsonPath = packagePath === null ? null : path.join(root, packagePath, 'package.json')
		const packageJson =
			pkgJsonPath !== null && realJsonIo.exists(pkgJsonPath)
				? (JSON.parse(realJsonIo.read(pkgJsonPath)) as Record<string, unknown>)
				: null

		return { manifestExists, manifest, packagePath, packageJson }
	},
	apply(root, plan) {
		applyVersionPlan(root, plan, realJsonIo)
	},
}
