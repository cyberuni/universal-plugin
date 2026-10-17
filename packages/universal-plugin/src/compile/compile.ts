import * as fs from 'node:fs'
import * as path from 'node:path'

import { readManifest, universalPluginExtension } from '../build/build.js'
import { getPackagePath } from '../config/config.js'
import { findInvisible, formatCodePoint } from './invisible.js'
import {
	binName,
	commandMap,
	compareScript,
	composeScript,
	parseScriptEntries,
	type ScriptBundleOptions,
	type ScriptComparison,
	type ScriptCompiler,
	type ScriptData,
	type ScriptEntry,
	sizeWarning,
} from './scripts.js'

export interface CompileOptions {
	dryRun?: boolean
}

/** One row per declared entry. A write reports `compiled` or `unchanged`; a dry run reports how the
 *  committed file compares (`unchanged`, `missing`, `version`, `stale` — see `compareScript`). */
export interface ScriptRow {
	path: string
	source: string
	status: 'compiled' | ScriptComparison | 'failed'
	bytes?: number
}

export interface CompileResult {
	rows: ScriptRow[]
	written: string[]
	warnings: string[]
	/** `behind` counts the committed files a dry run found missing, stale or on another version. */
	summary: { compiled: number; unchanged: number; behind: number; failed: number }
}

/** Compiles every script entry the canonical manifest declares into its self-contained `.mjs`
 *  (issue #177). The output is committed, like the derived vendor manifests, so a git-sourced install
 *  carries it too; a dry run writes nothing and reports which committed files are behind.
 *
 *  The embedded version is the canonical `plugin.json`'s, the way vendor manifests take theirs: the
 *  build never decides a version, so `plugin version` stamps `plugin.json` and the next compile
 *  carries it (#179). */
export async function compileScripts(
	root: string,
	opts: CompileOptions,
	compiler: ScriptCompiler,
): Promise<CompileResult> {
	const manifest = readManifest(root)
	const { entries, errors } = parseScriptEntries(universalPluginExtension(manifest).scripts)
	const rows: ScriptRow[] = []
	const written: string[] = []
	const warnings = [...errors]
	if (entries.length === 0) return { rows, written, warnings, summary: summarize(rows) }

	const packageJson = readPackageJson(root)
	const packageName = typeof packageJson?.['name'] === 'string' ? (packageJson['name'] as string) : null
	const commands = commandMap(entries)
	const bin = binName(packageJson)

	for (const entry of entries) {
		const sourcePath = path.resolve(root, entry.source)
		const outputPath = path.join(root, entry.output)
		if (!fs.existsSync(sourcePath)) {
			warnings.push(`script source "${entry.source}" for ${entry.output} not found — not compiled`)
			rows.push({ path: entry.output, source: entry.source, status: 'failed' })
			continue
		}
		let content: string
		try {
			const data: ScriptData = {
				package: packageName,
				bin,
				version: typeof manifest.version === 'string' ? manifest.version : null,
				entry: entry.output,
				commands,
			}
			content = composeScript(await compiler.compile(sourcePath, root, bundleOptions(entry)), entry, data)
		} catch (err) {
			warnings.push(
				`Failed to compile ${entry.source} → ${entry.output}: ${err instanceof Error ? err.message : String(err)}`,
			)
			rows.push({ path: entry.output, source: entry.source, status: 'failed' })
			continue
		}

		const bytes = Buffer.byteLength(content)
		const overBudget = sizeWarning(entry.output, bytes, bin)
		if (overBudget !== null) warnings.push(overBudget)
		const hidden = findInvisible(content)
		if (hidden.length > 0) warnings.push(invisibleWarning(entry.output, hidden))

		const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null
		const comparison = compareScript(existing, content)
		if (opts.dryRun || comparison === 'unchanged') {
			rows.push({ path: entry.output, source: entry.source, status: comparison, bytes })
			continue
		}
		fs.mkdirSync(path.dirname(outputPath), { recursive: true })
		fs.writeFileSync(outputPath, content)
		written.push(outputPath)
		rows.push({ path: entry.output, source: entry.source, status: 'compiled', bytes })
	}
	return { rows, written, warnings, summary: summarize(rows) }
}

/** The bundle options the entry sets, and none it does not. */
function bundleOptions({ alias, keepNames }: ScriptEntry): ScriptBundleOptions {
	return { ...(alias === undefined ? {} : { alias }), ...(keepNames === undefined ? {} : { keepNames }) }
}

/** The compiler escapes invisible characters inside literals; one left elsewhere (a comment, an
 *  identifier, a tagged template) is named so the author can find it before a skill check does. */
function invisibleWarning(output: string, hidden: ReturnType<typeof findInvisible>): string {
	const [first] = hidden
	const at = `${output}:${first?.line}:${first?.column} ${formatCodePoint(first?.codePoint ?? 0)}`
	const more = hidden.length > 1 ? ` and ${hidden.length - 1} more` : ''
	return `${at}${more}: invisible character in the compiled script that the build could not escape — skill checks reject it; write it as an escape in a string literal in the source`
}

/** The `package.json` at `packagePath` (`.agents/universal-plugin.json`), which names the package and
 *  bin a script falls back to; `null` when the plugin ships to no package. Its version is never read. */
function readPackageJson(root: string): Record<string, unknown> | null {
	const configPath = path.join(root, '.agents', 'universal-plugin.json')
	if (!fs.existsSync(configPath)) return null
	const packagePath = getPackagePath(JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>)
	if (packagePath === null) return null
	const pkgPath = path.join(root, packagePath, 'package.json')
	return fs.existsSync(pkgPath) ? (JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>) : null
}

function summarize(rows: ScriptRow[]): CompileResult['summary'] {
	return {
		compiled: rows.filter((r) => r.status === 'compiled').length,
		unchanged: rows.filter((r) => r.status === 'unchanged').length,
		behind: rows.filter((r) => r.status === 'stale' || r.status === 'missing' || r.status === 'version').length,
		failed: rows.filter((r) => r.status === 'failed').length,
	}
}
