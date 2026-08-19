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

/** Where each target's catalog sits, relative to the repository root. One place, because the
 *  generator writes these paths and `plugin init` reads the same ones to fold its entry in. */
export const TARGET_CATALOG_PATHS: Record<MarketplaceTarget, string> = {
	claude: '.claude-plugin/marketplace.json',
	cursor: '.cursor-plugin/marketplace.json',
	codex: '.agents/plugins/marketplace.json',
	copilot: '.github/plugin/marketplace.json',
}

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
		path: TARGET_CATALOG_PATHS.claude,
		content: json({
			$schema: CLAUDE_SCHEMA,
			...metadata,
			plugins: plugins.map((plugin) => ({ name: plugin.name, source: plugin.source, ...commonMetadata(plugin) })),
		}),
	}
}

function codexArtifact(metadata: MarketplaceMetadata, plugins: MarketplacePlugin[]): MarketplaceArtifact {
	return {
		path: TARGET_CATALOG_PATHS.codex,
		content: json({
			name: metadata.name,
			interface: { displayName: metadata.name },
			plugins: plugins.map((plugin) => ({
				name: plugin.name,
				// Codex caches a local install under the version its *manifest* carries, not this one,
				// and installs an entry that declares none (`.research/local-marketplaces`,
				// E-CODEX-M15, E-CODEX-M16). This is derived from the canonical manifest so the two
				// agree (ADR-0010 §3), and is absent when the manifest declares no version.
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
		path: TARGET_CATALOG_PATHS.copilot,
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
		path: TARGET_CATALOG_PATHS.cursor,
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
	/** Reads the catalog already at that target's path, keyed the way the artifact names it. */
	readExisting: (path: string) => string | undefined,
): MarketplaceArtifact {
	const artifact = serializeTarget(target, metadata, [plugin])[0] as MarketplaceArtifact
	const existing = readExisting(artifact.path)
	if (existing === undefined) return artifact

	const previous = parseCatalog(existing, artifact.path)
	const generated = JSON.parse(artifact.content) as Record<string, unknown>
	const entry = (generated.plugins as Record<string, unknown>[])[0] as Record<string, unknown>
	// The existing file's key order is kept — a refresh that reshuffles a catalog reads as a rewrite
	// in review. Only a key the catalog lacks is appended.
	const merged: Record<string, unknown> = { ...previous }
	for (const [key, value] of Object.entries(generated)) {
		if (!(key in merged)) merged[key] = value
	}
	merged.plugins = mergeEntries(previous, entry)
	return { path: artifact.path, content: json(merged) }
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

/** The catalog's own top-level identity, read back from the file the repository already carries, so
 *  a refresh re-derives one entry without proposing a name or an owner of its own. */
function existingMetadata(previous: Record<string, unknown>): MarketplaceMetadata {
	const name = typeof previous.name === 'string' ? previous.name : ''
	const owner = previous.owner
	if (typeof owner === 'object' && owner !== null && typeof (owner as MarketplaceOwner).name === 'string') {
		return { name, owner: owner as MarketplaceOwner }
	}
	return { name, owner: { name } }
}

/** Re-derives one plugin's entry inside a catalog the repository already carries. Update only, in two
 *  senses: it never creates a catalog — `plugin init --vendor` and `marketplace init` own that — and
 *  it adds nothing to the catalog's top level, not even a `$schema` the file happens to lack. Only
 *  the entry changes, so a build can run it unconditionally (ADR-0014). */
export function refreshCatalogEntry(
	target: MarketplaceTarget,
	plugin: MarketplacePlugin,
	existing: string,
): MarketplaceArtifact {
	const catalogPath = TARGET_CATALOG_PATHS[target]
	const previous = parseCatalog(existing, catalogPath)
	const generated = JSON.parse(serializeTarget(target, existingMetadata(previous), [plugin])[0]?.content ?? '{}')
	const entry = (generated.plugins as Record<string, unknown>[])[0] as Record<string, unknown>
	return { path: catalogPath, content: json({ ...previous, plugins: mergeEntries(previous, entry) }) }
}

/** Whether two catalogs say the same thing. Key order and whitespace do not change a catalog's
 *  meaning — the repository formats its own JSON — so a refresh compares this rather than bytes and
 *  leaves a file it agrees with alone. Array order does count. */
export function sameCatalogContent(a: string, b: string): boolean {
	try {
		return JSON.stringify(canonicalJson(JSON.parse(a))) === JSON.stringify(canonicalJson(JSON.parse(b)))
	} catch {
		return false
	}
}

function canonicalJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalJson)
	if (typeof value !== 'object' || value === null) return value
	const record = value as Record<string, unknown>
	return Object.fromEntries(
		Object.keys(record)
			.sort()
			.map((key) => [key, canonicalJson(record[key])]),
	)
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
