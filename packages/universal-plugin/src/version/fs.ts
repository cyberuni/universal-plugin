import * as fs from 'node:fs'
import * as path from 'node:path'

import { DEFAULT_MCP_PATH, type PluginManifest, universalPluginExtension, VENDOR_OUTPUT } from '../build/build.js'
import { getPackagePath } from '../config/config.js'
import { readEditorconfigIndent } from '../editorconfig/fs.js'
import { formatJson } from '../json.js'
import { gatherCatalogRepo } from '../marketplace/fs.js'
import { discoverWorkspace, realPinFs, resolveSkillsDir } from '../pin/fs.js'
import type { DriftFile, DriftState } from './drift.js'
import { PINS_MAP_PATH, type StampJson, type VersionPlan, type VersionState } from './version.js'

/** Minimal file access. `applyVersionPlan` is written against this rather than `node:fs`, so a test
 *  can watch every write the stamp makes. */
interface JsonIo {
	exists(filePath: string): boolean
	read(filePath: string): string
	write(filePath: string, content: string): void
}

const realJsonIo: JsonIo = {
	exists: (p) => fs.existsSync(p),
	read: (p) => fs.readFileSync(p, 'utf8'),
	write: (p, content) => {
		fs.mkdirSync(path.dirname(p), { recursive: true })
		fs.writeFileSync(p, content)
	},
}

export interface VersionFs {
	gather(root: string): VersionState
	apply(root: string, plan: VersionPlan): void
}

/** Reads `packagePath` from `.agents/universal-plugin.json` beside the canonical `plugin.json`; the
 *  path it names is relative to the plugin root. The manifest's extensions namespace is not a
 *  location for it (issue #79). Absent file, absent key, or a
 *  non-string value all mean "this plugin declares no npm package" — the manifest is then the only
 *  authored file. (A *declared* path whose `package.json` is missing is a different case, and the
 *  domain rejects it.) */
function readPackagePath(root: string, io: JsonIo): string | null {
	const configPath = path.join(root, '.agents', 'universal-plugin.json')
	if (!io.exists(configPath)) return null
	return getPackagePath(JSON.parse(io.read(configPath)) as Record<string, unknown>)
}

/** Writes `value` over `filePath` in that file's own format — its indentation, its trailing
 *  newline, and the text of every value left unchanged. A file with no indentation to read takes
 *  `.editorconfig`'s, then a tab. */
function writeJson(io: JsonIo, filePath: string, value: unknown): void {
	const existing = io.exists(filePath) ? io.read(filePath) : undefined
	io.write(filePath, formatJson(value, { existing, indent: readEditorconfigIndent(filePath) }))
}

/** Writes one JSON file in its own format, as the stamp writes every JSON file it touches. */
export function writeJsonFile(filePath: string, value: unknown): void {
	writeJson(realJsonIo, filePath, value)
}

/** The one applier. Writes every file the plan names — and nothing else: the derived vendor
 *  manifests are re-derived by calling `plugin build`, which owns them. */
function applyVersionPlan(root: string, plan: VersionPlan, io: JsonIo): void {
	writeJson(io, path.join(root, 'plugin.json'), plan.manifest)
	if (plan.packageJson) {
		writeJson(io, path.join(root, plan.packageJson.path), plan.packageJson.content)
	}
	for (const file of plan.files ?? []) io.write(path.join(root, file.path), file.content)
	for (const file of plan.json ?? []) writeJson(io, path.join(root, file.path), file.content)
}

function readJsonFile(io: JsonIo, filePath: string): Record<string, unknown> | null {
	return io.exists(filePath) ? (JSON.parse(io.read(filePath)) as Record<string, unknown>) : null
}

/** The authored `mcpServers` files the manifest's declaration names — a path, a list of paths, or a
 *  `{ paths }` block — or the spec-fixed `mcp.json` when it declares none. An inline declaration is
 *  stamped inside `plugin.json`, and an unreadable file is left to `plugin build` to warn about. */
function gatherMcpFiles(root: string, declaration: unknown): StampJson[] {
	let paths: string[]
	if (typeof declaration === 'string') paths = [declaration]
	else if (Array.isArray(declaration)) paths = declaration as string[]
	else if (declaration && typeof declaration === 'object') {
		const block = (declaration as Record<string, unknown>)['paths']
		paths = Array.isArray(block) ? (block as string[]) : []
	} else paths = fs.existsSync(path.resolve(root, DEFAULT_MCP_PATH)) ? [DEFAULT_MCP_PATH] : []

	const files: StampJson[] = []
	for (const rel of paths) {
		const abs = path.resolve(root, rel)
		try {
			const content = JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown
			if (content && typeof content === 'object' && !Array.isArray(content)) {
				files.push({ path: toRelative(root, abs), content: content as Record<string, unknown> })
			}
		} catch {
			// Missing or unreadable: nothing to stamp.
		}
	}
	return files
}

function toRelative(root: string, abs: string): string {
	return path.relative(root, abs).split(path.sep).join('/')
}

export const realVersionFs: VersionFs = {
	gather(root) {
		const manifestPath = path.join(root, 'plugin.json')
		const manifestExists = realJsonIo.exists(manifestPath)
		const manifest = manifestExists ? (JSON.parse(realJsonIo.read(manifestPath)) as Record<string, unknown>) : null

		const packagePath = readPackagePath(root, realJsonIo)
		const packageJson =
			packagePath === null ? null : readJsonFile(realJsonIo, path.join(root, packagePath, 'package.json'))
		const rootPackageJson = packagePath === null ? readJsonFile(realJsonIo, path.join(root, 'package.json')) : null

		const uext = universalPluginExtension((manifest ?? {}) as PluginManifest)
		const skillsDir = resolveSkillsDir(root, uext.skills as string | undefined)
		const pinFs = realPinFs(skillsDir)
		const skillFiles = pinFs
			.listSkillFiles()
			.map((abs) => ({ path: toRelative(root, abs), content: pinFs.readFile(abs) }))

		return {
			manifestExists,
			manifest,
			packagePath,
			packageJson,
			rootPackageJson,
			skillFiles,
			workspace: Object.fromEntries(discoverWorkspace(root)),
			mcpFiles: gatherMcpFiles(root, uext['mcpServers']),
			pinsMapExists: fs.existsSync(path.join(root, PINS_MAP_PATH)),
		}
	},
	apply(root, plan) {
		applyVersionPlan(root, plan, realJsonIo)
	},
}

/** Reads every file that carries the plugin's version, for `checkVersionDrift`. Paths are relative
 *  to the plugin root, so a catalog at the repository root above a monorepo plugin reads as
 *  `../../.claude-plugin/marketplace.json`. Only what exists is read: a vendor not declared, or a
 *  catalog the repository does not carry, is not a file left behind. */
export function gatherDriftState(root: string): DriftState {
	const manifestPath = path.join(root, 'plugin.json')
	if (!fs.existsSync(manifestPath)) throw new Error(`No plugin.json found at ${root}`)
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>

	const packagePath = readPackagePath(root, realJsonIo)
	const pkgJsonPath = packagePath === null ? null : path.join(root, packagePath, 'package.json')
	const packageJson =
		pkgJsonPath !== null && fs.existsSync(pkgJsonPath)
			? (JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>)
			: null

	const relative = (abs: string) => path.relative(root, abs).split(path.sep).join('/')
	const read = (abs: string): DriftFile => ({ path: relative(abs), content: fs.readFileSync(abs, 'utf8') })

	const uext = universalPluginExtension(manifest as PluginManifest)
	const targets = uext.vendors ?? Object.keys(uext.harnesses ?? {})
	const vendorManifests = targets
		.map((vendor) => (VENDOR_OUTPUT as Record<string, string>)[vendor])
		.filter((rel): rel is string => rel !== undefined && rel !== 'plugin.json')
		.map((rel) => path.join(root, rel))
		.filter((abs) => fs.existsSync(abs))
		.map(read)

	const repo = gatherCatalogRepo(root)
	const catalogs = repo
		? Object.entries(repo.catalogs).map(([rel, content]) => ({ path: relative(path.join(repo.root, rel)), content }))
		: []

	const skillsDir = resolveSkillsDir(root, uext.skills as string | undefined)
	const skillFiles = realPinFs(skillsDir).listSkillFiles().map(read)

	return { manifest, packagePath, packageJson, vendorManifests, catalogs, skillFiles }
}
