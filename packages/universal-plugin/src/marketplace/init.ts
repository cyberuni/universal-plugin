import * as path from 'node:path'

import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import {
	adaptCatalogContent,
	assertMarketplaceName,
	CLAUDE_CATALOG_READERS,
	catalogEntryNames,
	type MarketplaceOwner,
	type MarketplacePlugin,
	type MarketplaceStatus,
	type MarketplaceTarget,
	mergeDiscoveredCatalog,
	type OmittedEntry,
	serializeTarget,
	TARGET_CATALOG_PATHS,
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
	/** Entries the runtime cannot install, left out of its catalog. */
	omitted?: OmittedEntry[]
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

/** The catalog's own identity: its name and its owner, from the root manifest unless overridden.
 *  Exported because `marketplace add` creates a catalog in a repository that has no plugins of its
 *  own to discover, and the two commands must name that catalog the same way. */
export function deriveMetadata(root: string, fs: MarketplaceFs, opts: MarketplaceInitOptions): RootMetadata {
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

function readCatalog(fs: MarketplaceFs, file: string): string | undefined {
	return fs.exists(file) ? fs.read(file) : undefined
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

/** The entries a runtime with no catalog of its own would have read from the Claude one, as the
 *  starting point for its catalog. Codex states an entry its own way, so those are re-shaped. */
function sharedStart(target: MarketplaceTarget, claudeContent: string | undefined): string | undefined {
	if (claudeContent === undefined) return undefined
	if (target !== 'codex') return claudeContent
	const plugins = (JSON.parse(claudeContent) as { plugins?: Record<string, unknown>[] }).plugins ?? []
	return JSON.stringify({
		plugins: plugins.map((entry) => ({
			name: entry.name,
			...(typeof entry.version === 'string' ? { version: entry.version } : {}),
			source: entry.source,
			policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
			category: 'Productivity',
		})),
	})
}

export function initializeMarketplace(
	rootInput: string,
	opts: MarketplaceInitOptions = {},
	fs: MarketplaceFs = realMarketplaceFs,
): MarketplaceResult[] {
	const root = path.resolve(rootInput)
	const metadata = deriveMetadata(root, fs, opts)
	const plugins = discoverPlugins(root, fs, opts.scanDirs)
	const requested = selectedTargets(opts.targets)
	const targets = requested.includes('claude')
		? ['claude' as const, ...requested.filter((t) => t !== 'claude')]
		: requested
	const derived = new Map(targets.map((target) => [target, serializeTarget(target, metadata, plugins)]))
	const readOwn = (artifact: { path: string }) => readCatalog(fs, path.join(root, artifact.path))

	// Discovery describes the plugins this repository holds; a catalog may also list plugins that
	// live elsewhere, which only `marketplace add` puts there. Each artifact is folded into the file
	// already on disk so a regeneration never reports those as deletions. Folding reads that file,
	// so it runs only once the path has been proved to resolve inside --root.
	//
	// What a runtime cannot install is then adapted or left out of its catalog. A runtime with no
	// catalog of its own yet starts from the Claude one it would otherwise read.
	const planTarget = (target: MarketplaceTarget, claudeContent: string | undefined) => {
		const omitted: OmittedEntry[] = []
		const artifacts = (derived.get(target) ?? []).map((artifact) => {
			assertContained(root, path.join(root, artifact.path), fs, 'selected artifact')
			const shared = CLAUDE_CATALOG_READERS.includes(target) ? sharedStart(target, claudeContent) : undefined
			const merged = mergeDiscoveredCatalog(artifact, readOwn(artifact) ?? shared)
			const adapted = adaptCatalogContent(target, merged.content)
			omitted.push(...adapted.omitted)
			return { path: merged.path, content: adapted.content }
		})
		return { target, artifacts, omitted }
	}
	const planned: ReturnType<typeof planTarget>[] = []
	let claudeContent: string | undefined
	for (const target of targets) {
		const plan = planTarget(target, claudeContent)
		if (target === 'claude') claudeContent = plan.artifacts[0]?.content
		planned.push(plan)
	}
	// Copilot CLI and Cursor read the Claude catalog when they find none of their own, and one
	// entry they cannot install makes Copilot CLI refuse the whole catalog. A catalog of their own
	// comes first in their search, so writing it shields them even when they were not asked for.
	const shielded = new Set<MarketplaceTarget>()
	if (claudeContent !== undefined) {
		for (const target of ['copilot', 'cursor'] as const) {
			if (targets.includes(target)) continue
			if (adaptCatalogContent(target, claudeContent).omitted.length === 0) continue
			derived.set(target, serializeTarget(target, metadata, plugins))
			planned.push(planTarget(target, claudeContent))
			shielded.add(target)
		}
	}
	for (const { target, artifacts } of planned) {
		for (const artifact of artifacts) {
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

	const results: MarketplaceResult[] = planned.map(({ target, artifacts, omitted }) => {
		if (plugins.length === 0)
			return { target, status: 'empty', paths: [], plugins: [], reason: 'no plugins discovered' }
		const unchanged = artifacts.every((artifact) => sameArtifact(fs, path.join(root, artifact.path), artifact.content))
		return {
			target,
			status: opts.dryRun ? 'planned' : unchanged ? 'unchanged' : 'generated',
			paths: artifacts.map((artifact) => artifact.path),
			// What the catalog ends up listing, not only what discovery contributed, so an entry kept
			// from the existing file is visible in the report rather than silently present.
			plugins: [...new Set(artifacts.flatMap((artifact) => catalogEntryNames(artifact.content)))],
			...(omitted.length > 0 ? { omitted } : {}),
			...(shielded.has(target)
				? {
						reason: `written so ${target} does not read ${TARGET_CATALOG_PATHS.claude}, which lists entries it cannot install`,
					}
				: {}),
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
