import * as path from 'node:path'

import { type MarketplaceFs, realMarketplaceFs } from './fs.js'
import {
	assertMarketplaceName,
	type MarketplacePlugin,
	type MarketplaceStatus,
	type MarketplaceTarget,
	serializeTarget,
} from './marketplace.js'

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
	owner: string
}

function isInside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate)
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
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

function manifestOwner(manifest: Record<string, unknown>): string | undefined {
	if (typeof manifest.author === 'string') return manifest.author
	if (typeof manifest.author === 'object' && manifest.author !== null) {
		const author = manifest.author as Record<string, unknown>
		if (typeof author.name === 'string') return author.name
	}
	return undefined
}

function deriveMetadata(root: string, fs: MarketplaceFs, opts: MarketplaceInitOptions): RootMetadata {
	const rootManifest = path.join(root, 'plugin.json')
	const manifest = fs.exists(rootManifest) ? parseManifest(fs, rootManifest) : {}
	const name = opts.name ?? path.basename(root)
	const owner = opts.owner ?? manifestOwner(manifest)
	assertMarketplaceName(name, 'marketplace name')
	if (!owner || owner.trim() === '')
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
	}
	return roots.filter((scanRoot) => fs.exists(scanRoot))
}

function discoverPlugins(root: string, fs: MarketplaceFs, scanDirs?: string[]): MarketplacePlugin[] {
	const plugins: MarketplacePlugin[] = []
	const names = new Set<string>()
	for (const scanRoot of scanRoots(root, fs, scanDirs)) {
		for (const manifestPath of fs.listFiles(scanRoot).sort()) {
			if (path.resolve(manifestPath) === path.join(root, 'plugin.json')) continue
			const relativeManifest = path.relative(root, manifestPath).split(path.sep).join('/')
			if (/(^|\/)(\.plugin|\.claude-plugin|\.codex-plugin|\.cursor-plugin)\//.test(relativeManifest)) continue
			const manifest = parseManifest(fs, manifestPath)
			if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
				throw new Error(`error: manifest "${manifestPath}" must contain a non-empty name`)
			}
			assertMarketplaceName(manifest.name, 'plugin name')
			if (names.has(manifest.name)) throw new Error(`error: duplicate plugin name "${manifest.name}"`)
			names.add(manifest.name)
			const source = `./${path.relative(root, path.dirname(manifestPath)).split(path.sep).join('/')}`
			if (!isInside(root, path.resolve(root, source)))
				throw new Error(`error: plugin source "${source}" must resolve within --root`)
			plugins.push({ name: manifest.name, source, metadata: manifest })
		}
	}
	return plugins.sort((a, b) => a.name.localeCompare(b.name))
}

function selectedTargets(targets?: MarketplaceTarget[]): MarketplaceTarget[] {
	return targets && targets.length > 0 ? [...new Set(targets)] : ['claude', 'codex', 'copilot']
}

function sameArtifact(fs: MarketplaceFs, file: string, content: string): boolean {
	if (!fs.exists(file)) return false
	const existing = fs.read(file)
	if (!file.endsWith('.json')) return existing === content
	try {
		return JSON.stringify(JSON.parse(existing)) === JSON.stringify(JSON.parse(content))
	} catch {
		return false
	}
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
		for (const { artifacts } of planned) {
			for (const artifact of artifacts) {
				const output = path.join(root, artifact.path)
				if (!sameArtifact(fs, output, artifact.content)) fs.writeAtomically(output, artifact.content)
			}
		}
	}

	if (!opts.targets || opts.targets.length === 0) {
		results.push({
			target: 'cursor',
			status: 'skipped-default',
			paths: [],
			plugins: [],
			reason: 'Cursor requires an explicit submission scaffold',
		})
	}
	return results
}
