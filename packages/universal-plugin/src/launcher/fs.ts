import * as fs from 'node:fs'
import * as path from 'node:path'

import { readManifest, universalPluginExtension } from '../build/build.js'
import { getPackagePath } from '../config/config.js'
import {
	compareLauncher,
	composeLauncher,
	LAUNCHER_DIR,
	LAUNCHER_MODE,
	type LauncherComparison,
	parseLauncherEntries,
	publishedFilesWarning,
} from './launcher.js'

export interface LauncherRow {
	path: string
	entry: string
	status: 'written' | LauncherComparison
}

export interface LauncherResult {
	rows: LauncherRow[]
	written: string[]
	warnings: string[]
	/** `behind` counts the launchers a dry run found missing or stale. */
	summary: { written: number; unchanged: number; behind: number }
}

/** Writes `bin/<name>` for every launcher the canonical manifest declares. The output is committed, like
 *  the derived vendor manifests; a dry run writes nothing and reports which committed files are behind. */
export function writeLaunchers(root: string, opts: { dryRun?: boolean }): LauncherResult {
	const manifest = readManifest(root)
	const { entries, errors } = parseLauncherEntries(universalPluginExtension(manifest).launchers)
	const rows: LauncherRow[] = []
	const written: string[] = []
	const warnings = [...errors]
	if (entries.length === 0) return { rows, written, warnings, summary: summarize(rows) }

	const packageJson = readPackageJson(root)
	const packageName = typeof packageJson?.['name'] === 'string' ? packageJson['name'] : null
	if (packageJson !== null) {
		const filesWarning = publishedFilesWarning(packageJson['files'])
		if (filesWarning !== null) warnings.push(filesWarning)
	}

	for (const launcher of entries) {
		const relative = `${LAUNCHER_DIR}/${launcher.name}`
		const outputPath = path.join(root, relative)
		const composed = composeLauncher(launcher, packageName)
		const existing = fs.existsSync(outputPath)
			? { content: fs.readFileSync(outputPath, 'utf8'), mode: fs.statSync(outputPath).mode }
			: null
		const comparison = compareLauncher(existing, composed)
		if (opts.dryRun || comparison === 'unchanged') {
			rows.push({ path: relative, entry: launcher.entry, status: comparison })
			continue
		}
		fs.mkdirSync(path.dirname(outputPath), { recursive: true })
		fs.writeFileSync(outputPath, composed)
		fs.chmodSync(outputPath, LAUNCHER_MODE)
		written.push(outputPath)
		rows.push({ path: relative, entry: launcher.entry, status: 'written' })
	}
	return { rows, written, warnings, summary: summarize(rows) }
}

/** The `package.json` at `packagePath`; `null` when the plugin ships to no package. */
function readPackageJson(root: string): Record<string, unknown> | null {
	const configPath = path.join(root, '.agents', 'universal-plugin.json')
	if (!fs.existsSync(configPath)) return null
	const packagePath = getPackagePath(JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>)
	if (packagePath === null) return null
	const pkgPath = path.join(root, packagePath, 'package.json')
	return fs.existsSync(pkgPath) ? (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>) : null
}

function summarize(rows: LauncherRow[]): LauncherResult['summary'] {
	return {
		written: rows.filter((r) => r.status === 'written').length,
		unchanged: rows.filter((r) => r.status === 'unchanged').length,
		behind: rows.filter((r) => r.status === 'missing' || r.status === 'stale').length,
	}
}
