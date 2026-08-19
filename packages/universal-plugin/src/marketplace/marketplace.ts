export type MarketplaceTarget = 'claude' | 'codex' | 'copilot' | 'cursor'
export type MarketplaceStatus = 'generated' | 'unchanged' | 'planned' | 'empty'

/** Claude Code and Cursor both require `owner` to be an object carrying `name`; a string is a
 *  schema error on Claude Code (`.research/local-marketplaces`, E-CC-M6). */
export interface MarketplaceOwner {
	name: string
	email?: string
	url?: string
}

export interface MarketplacePlugin {
	name: string
	source: string
	metadata: Record<string, unknown>
}

export interface MarketplaceMetadata {
	name: string
	owner: MarketplaceOwner
}

export interface MarketplaceArtifact {
	path: string
	content: string
}

/** Claude Code ignores `$schema` at load time; it is there for editor completion and for
 *  `claude plugin validate`. Cursor documents no schema key, so only Claude's catalog carries one. */
const CLAUDE_SCHEMA = 'https://json.schemastore.org/claude-code-marketplace.json'

const COMMON_METADATA = ['description', 'version', 'homepage', 'repository', 'license', 'keywords']

export function assertMarketplaceName(value: string, label: string): void {
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
		throw new Error(`error: ${label} "${value}" must contain only letters, digits, dots, underscores, or hyphens`)
	}
}

function commonMetadata(plugin: MarketplacePlugin): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const field of COMMON_METADATA) {
		if (plugin.metadata[field] !== undefined) result[field] = plugin.metadata[field]
	}
	return result
}

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`
}

function claudeArtifact(metadata: MarketplaceMetadata, plugins: MarketplacePlugin[]): MarketplaceArtifact {
	return {
		path: '.claude-plugin/marketplace.json',
		content: json({
			$schema: CLAUDE_SCHEMA,
			...metadata,
			plugins: plugins.map((plugin) => ({ name: plugin.name, source: plugin.source, ...commonMetadata(plugin) })),
		}),
	}
}

function codexArtifact(metadata: MarketplaceMetadata, plugins: MarketplacePlugin[]): MarketplaceArtifact {
	return {
		path: '.agents/plugins/marketplace.json',
		content: json({
			name: metadata.name,
			interface: { displayName: metadata.name },
			plugins: plugins.map((plugin) => ({
				name: plugin.name,
				// Codex caches local installs by this version. Keep it derived from the
				// canonical manifest rather than leaving a second hand-authored version.
				version: plugin.metadata.version,
				source: { source: 'local', path: plugin.source },
				policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
				category: 'Productivity',
			})),
		}),
	}
}

function copilotArtifact(metadata: MarketplaceMetadata, plugins: MarketplacePlugin[]): MarketplaceArtifact {
	return {
		path: '.github/plugin/marketplace.json',
		content: json({
			...metadata,
			metadata: { displayName: metadata.name },
			plugins: plugins.map((plugin) => ({ name: plugin.name, source: plugin.source, ...commonMetadata(plugin) })),
		}),
	}
}

/** Cursor reads `.cursor-plugin/marketplace.json` at the repository root, with a shape close to
 *  Claude Code's. It is not an install path for the author: a developer tests through
 *  `~/.cursor/plugins/local/<name>`, and the catalog reaches users when an admin imports the
 *  repository as a team marketplace (`.research/local-marketplaces`, E-CUR-M3, E-CUR-M4). */
function cursorArtifact(metadata: MarketplaceMetadata, plugins: MarketplacePlugin[]): MarketplaceArtifact {
	return {
		path: '.cursor-plugin/marketplace.json',
		content: json({
			...metadata,
			plugins: plugins.map((plugin) => ({ name: plugin.name, source: plugin.source, ...commonMetadata(plugin) })),
		}),
	}
}

/** The marketplace target each `--vendor` id catalogs into. Every vendor documents a
 *  repository-local catalog (`.research/local-marketplaces`). */
export const VENDOR_TARGETS: Record<string, MarketplaceTarget> = {
	'claude-code': 'claude',
	cursor: 'cursor',
	codex: 'codex',
	'copilot-cli': 'copilot',
}

/** Folds one plugin's entry into a catalog that may already exist, and returns the artifact to
 *  write. An existing catalog keeps its own top-level fields — its name, its owner, a description
 *  someone wrote — and every entry it lists for other plugins, in place. Only this plugin's entry is
 *  re-derived.
 *
 *  `version` is derived, never authored (ADR-0010 §3): the entry carries whatever the canonical
 *  manifest carries, and a version left behind on an entry whose manifest declares none is removed
 *  rather than kept. */
export function mergeCatalogEntry(
	target: MarketplaceTarget,
	metadata: MarketplaceMetadata,
	plugin: MarketplacePlugin,
	existing: string | undefined,
): MarketplaceArtifact {
	const artifact = serializeTarget(target, metadata, [plugin])[0] as MarketplaceArtifact
	if (existing === undefined) return artifact

	const previous = parseCatalog(existing, artifact.path)
	const generated = JSON.parse(artifact.content) as Record<string, unknown>
	const entry = (generated.plugins as Record<string, unknown>[])[0] as Record<string, unknown>
	return { path: artifact.path, content: json({ ...generated, ...previous, plugins: mergeEntries(previous, entry) }) }
}

function parseCatalog(content: string, path: string): Record<string, unknown> {
	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		throw new Error(`error: existing catalog "${path}" is not valid JSON`)
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new Error(`error: existing catalog "${path}" is not a JSON object`)
	}
	return parsed as Record<string, unknown>
}

function mergeEntries(previous: Record<string, unknown>, entry: Record<string, unknown>): Record<string, unknown>[] {
	const entries = Array.isArray(previous.plugins) ? [...(previous.plugins as unknown[])] : []
	const index = entries.findIndex(
		(candidate) =>
			typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>).name === entry.name,
	)
	if (index === -1) return [...entries, entry] as Record<string, unknown>[]
	const merged = { ...(entries[index] as Record<string, unknown>), ...entry }
	if (!('version' in entry)) delete merged.version
	entries[index] = merged
	return entries as Record<string, unknown>[]
}

export function serializeTarget(
	target: MarketplaceTarget,
	metadata: MarketplaceMetadata,
	plugins: MarketplacePlugin[],
): MarketplaceArtifact[] {
	switch (target) {
		case 'claude':
			return [claudeArtifact(metadata, plugins)]
		case 'codex':
			return [codexArtifact(metadata, plugins)]
		case 'copilot':
			return [copilotArtifact(metadata, plugins)]
		case 'cursor':
			return [cursorArtifact(metadata, plugins)]
	}
}
