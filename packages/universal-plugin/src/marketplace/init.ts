import * as path from 'node:path'

import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import {
	assertMarketplaceName,
	type MarketplaceOwner,
	type MarketplacePlugin,
	type MarketplaceStatus,
	type MarketplaceTarget,
	serializeTarget,
} from './marketplace.js'
import { formatCatalogIssues, validateCatalogContent } from './validation.js'

export interface MarketplaceInitOptions {
	targets?: MarketplaceTarget[]
	scanDirs?: string[]
	name?: string
	owner?: string
	dryRun?: boolean
	force?: boolean
}

export interface MarketplaceResult {
	target: MarketplaceTarget
	status: MarketplaceStatus
	paths: string[]
	plugins: string[]
	reason?: string
}

interface RootMetadata {
	name: string
	owner: MarketplaceOwner
}

function isInside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate)
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function containingExistingPath(file: string, fs: MarketplaceFs): string {
	let current = file
	while (!fs.exists(current)) {
		const parent = path.dirname(current)
		if (parent === current) throw new Error(`error: path "${file}" must resolve within --root`)
		current = parent
	}
	return current
}

function assertContained(root: string, candidate: string, fs: MarketplaceFs, label: string): void {
	const resolvedRoot = fs.realpath(root)
	const resolvedCandidate = fs.realpath(containingExistingPath(candidate, fs))
	if (!isInside(resolvedRoot, resolvedCandidate))
		throw new Error(`error: ${label} "${candidate}" must resolve within --root`)
}

function parseManifest(fs: MarketplaceFs, file: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(fs.read(file))
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
		return parsed as Record<string, unknown>
	} catch {
		throw new Error(`error: manifest "${file}" is not valid JSON`)
	}
}

/** The canonical manifest's `author` — a string or an `{ name, email?, url? }` object — read as the
 *  catalog owner every runtime requires as an object. */
function manifestOwner(manifest: Record<string, unknown>): MarketplaceOwner | undefined {
	if (typeof manifest.author === 'string') return { name: manifest.author }
	if (typeof manifest.author === 'object' && manifest.author !== null) {
		const author = manifest.author as Record<string, unknown>
		if (typeof author.name !== 'string') return undefined
		const owner: MarketplaceOwner = { name: author.name }
		if (typeof author.email === 'string') owner.email = author.email
		if (typeof author.url === 'string') owner.url = author.url
		return owner
	}
	return undefined
}

function deriveMetadata(root: string, fs: MarketplaceFs, opts: MarketplaceInitOptions): RootMetadata {
	const rootManifest = path.join(root, 'plugin.json')
	if (fs.exists(rootManifest)) assertContained(root, rootManifest, fs, 'root plugin.json')
	const manifest = fs.exists(rootManifest) ? parseManifest(fs, rootManifest) : {}
	const name = opts.name ?? path.basename(root)
	const owner = opts.owner !== undefined ? { name: opts.owner } : manifestOwner(manifest)
	assertMarketplaceName(name, 'marketplace name')
	if (!owner || owner.name.trim() === '')
		throw new Error('error: marketplace owner is required; set --owner or root plugin.json author')
	return { name, owner }
}

function scanRoots(root: string, fs: MarketplaceFs, scanDirs?: string[]): string[] {
	const requested = scanDirs ?? ['plugins']
	const roots = [...new Set(requested.map((dir) => path.resolve(root, dir)))].sort()
	for (const scanRoot of roots) {
		if (!isInside(root, scanRoot)) throw new Error(`error: --plugin-scan-dir "${scanRoot}" must resolve within --root`)
		if (!fs.exists(scanRoot)) {
			if (scanDirs === undefined) continue
			throw new Error(`error: plugin scan directory "${scanRoot}" does not exist`)
		}
		if (!fs.isDirectory(scanRoot)) throw new Error(`error: plugin scan directory "${scanRoot}" is not a directory`)
		assertContained(root, scanRoot, fs, '--plugin-scan-dir')
	}
	return roots.filter((scanRoot) => fs.exists(scanRoot))
}

function discoverPlugins(root: string, fs: MarketplaceFs, scanDirs?: string[]): MarketplacePlugin[] {
	const plugins: MarketplacePlugin[] = []
	const names = new Set<string>()
	for (const scanRoot of scanRoots(root, fs, scanDirs)) {
		for (const entry of fs.listEntries(scanRoot).sort()) {
			if (['.plugin', '.claude-plugin', '.codex-plugin', '.cursor-plugin'].includes(entry)) continue
			const pluginRoot = path.join(scanRoot, entry)
			if (!fs.isDirectory(pluginRoot)) continue
			assertContained(root, pluginRoot, fs, 'plugin directory')
			const manifestPath = path.join(pluginRoot, 'plugin.json')
			if (!fs.exists(manifestPath)) continue
			assertContained(root, manifestPath, fs, 'plugin manifest')
			const manifest = parseManifest(fs, manifestPath)
			if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
				throw new Error(`error: manifest "${manifestPath}" must contain a non-empty name`)
			}
			assertMarketplaceName(manifest.name, 'plugin name')
			if (names.has(manifest.name)) throw new Error(`error: duplicate plugin name "${manifest.name}"`)
			names.add(manifest.name)
			const source = `./${path.relative(root, pluginRoot).split(path.sep).join('/')}`
			plugins.push({ name: manifest.name, source, metadata: manifest })
		}
	}
	return plugins.sort((a, b) => a.name.localeCompare(b.name))
}

function writeArtifacts(fs: MarketplaceFs, artifacts: { path: string; content: string }[], root: string): void {
	const changed = artifacts.filter((artifact) => !sameArtifact(fs, path.join(root, artifact.path), artifact.content))
	for (const artifact of changed) fs.writeAtomically(path.join(root, artifact.path), artifact.content)
}

function selectedTargets(targets?: MarketplaceTarget[]): MarketplaceTarget[] {
	return targets && targets.length > 0 ? [...new Set(targets)] : ['claude', 'codex', 'copilot', 'cursor']
}

function sameArtifact(fs: MarketplaceFs, file: string, content: string): boolean {
	if (!fs.exists(file)) return false
	const existing = fs.read(file)
	if (!file.endsWith('.json')) return existing === content
	try {
		return JSON.stringify(normalizeJson(JSON.parse(existing))) === JSON.stringify(normalizeJson(JSON.parse(content)))
	} catch {
		return false
	}
}

/** JSON object key order and whitespace do not change a catalog's meaning; array order does. */
function normalizeJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeJson)
	if (typeof value !== 'object' || value === null) return value
	const record = value as Record<string, unknown>
	return Object.fromEntries(
		Object.keys(record)
			.sort()
			.map((key) => [key, normalizeJson(record[key])]),
	)
}

export function initializeMarketplace(
	rootInput: string,
	opts: MarketplaceInitOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): MarketplaceResult[] {
	const root = path.resolve(rootInput)
	const metadata = deriveMetadata(root, fs, opts)
	const plugins = discoverPlugins(root, fs, opts.scanDirs)
	const targets = selectedTargets(opts.targets)
	const planned = targets.map((target) => ({ target, artifacts: serializeTarget(target, metadata, plugins) }))
	for (const { target, artifacts } of planned) {
		for (const artifact of artifacts) {
			assertContained(root, path.join(root, artifact.path), fs, 'selected artifact')
			// A catalog the runtime would reject is worse than no catalog: it is discovered, read, and
			// refused at install time, far from here. Check before anything is written, so a manifest
			// this command cannot reduce to a valid entry stops the whole run.
			const issues = validateCatalogContent(target, artifact.content)
			if (issues.length > 0) throw new Error(formatCatalogIssues(artifact.path, issues))
		}
	}

	const conflicts: string[] = []
	for (const entry of planned) {
		for (const artifact of entry.artifacts) {
			const output = path.join(root, artifact.path)
			if (fs.exists(output) && !sameArtifact(fs, output, artifact.content) && !opts.force) conflicts.push(artifact.path)
		}
	}
	if (conflicts.length > 0)
		throw new Error(
			`error: generated artifact differs: ${conflicts.join(', ')}; rerun with --force to replace selected artifacts`,
		)

	const results: MarketplaceResult[] = planned.map(({ target, artifacts }) => {
		if (plugins.length === 0)
			return { target, status: 'empty', paths: [], plugins: [], reason: 'no plugins discovered' }
		const unchanged = artifacts.every((artifact) => sameArtifact(fs, path.join(root, artifact.path), artifact.content))
		return {
			target,
			status: opts.dryRun ? 'planned' : unchanged ? 'unchanged' : 'generated',
			paths: artifacts.map((artifact) => artifact.path),
			plugins: plugins.map((plugin) => plugin.name),
		}
	})

	if (!opts.dryRun && plugins.length > 0) {
		writeArtifacts(
			fs,
			planned.flatMap((entry) => entry.artifacts),
			root,
		)
	}
	return results
}
