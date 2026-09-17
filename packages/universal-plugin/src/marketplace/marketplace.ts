export type MarketplaceTarget = 'claude' | 'codex' | 'copilot' | 'cursor'
export type MarketplaceStatus = 'generated' | 'unchanged' | 'planned' | 'empty'

/** Claude Code and Cursor both require `owner` to be an object carrying `name`; a string is a
 *  schema error on Claude Code (`.research/local-marketplaces`, E-CC-M6). */
export interface MarketplaceOwner {
	name: string
	email?: string
	url?: string
}

/** A source a catalog entry may name other than a path in this repository, in the tagged shape the
 *  official schema states: `{ source: "npm", package }`, `{ source: "github", repo }`,
 *  `{ source: "url", url }`, or `{ source: "git-subdir", url, path }`. */
export type CatalogSource = { source: string } & Record<string, unknown>

export interface MarketplacePlugin {
	name: string
	/** A `./`-prefixed repository-relative path, or a tagged remote source. */
	source: string | CatalogSource
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

/** A manifest field carried into a catalog entry, in the shape the catalog schema states. A manifest
 *  written from a `package.json` carries `repository` as `{ type, url }`, and every catalog wants the
 *  URL alone — Claude Code rejects the object (`plugins[].repository: expected string`). A value that
 *  cannot be reduced to the right type is dropped rather than written: an entry missing an optional
 *  field still installs, an entry with the wrong type installs nowhere. */
function catalogValue(field: string, value: unknown): unknown {
	if (field === 'keywords') {
		return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined
	}
	if (field === 'repository' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
		const url = (value as Record<string, unknown>).url
		return typeof url === 'string' ? url.replace(/^git\+/, '') : undefined
	}
	return typeof value === 'string' ? value : undefined
}

function commonMetadata(plugin: MarketplacePlugin): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	for (const field of COMMON_METADATA) {
		if (plugin.metadata[field] === undefined) continue
		const value = catalogValue(field, plugin.metadata[field])
		if (value !== undefined) result[field] = value
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

/** Whether a catalog entry's `source` names a place inside this repository — a `./`-prefixed path in
 *  the Claude-shaped catalogs, or Codex's `{ source: "local", path }`. Every other form names a
 *  plugin distributed from somewhere else: an npm package, a GitHub repository, a URL. Discovery
 *  walks directories, so it can produce the first kind and can say nothing about the second. */
export function isLocalCatalogSource(source: unknown): boolean {
	if (typeof source === 'string') return true
	if (typeof source !== 'object' || source === null || Array.isArray(source)) return false
	return (source as Record<string, unknown>).source === 'local'
}

/** Codex states a source as an object either way: a repository path is tagged `local`, and a source
 *  that already carries its own tag passes through as it stands. */
function codexSource(source: string | CatalogSource): CatalogSource {
	return typeof source === 'string' ? { source: 'local', path: source } : source
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
				source: codexSource(plugin.source),
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

/** The source forms each runtime installs from.
 *
 *  Every runtime takes a repository path. Beyond that they diverge, and the divergence is not
 *  cosmetic: a catalog is read at install time in someone else's terminal, so a source a runtime
 *  cannot resolve is a failure far from here. Claude Code's schema documents the full tagged set
 *  (<https://json.schemastore.org/claude-code-marketplace.json>). Codex documents npm alongside a
 *  local path. Copilot CLI and Cursor document local paths only, which is why an npm entry reaches
 *  two catalogs rather than four (`.research/local-marketplaces`, and issue #86). */
export const TARGET_SOURCE_KINDS: Record<MarketplaceTarget, readonly string[]> = {
	claude: ['path', 'npm', 'github', 'url', 'git-subdir'],
	codex: ['path', 'npm'],
	copilot: ['path'],
	cursor: ['path'],
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
	{ keepForeignSource = true } = {},
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
	merged.plugins = mergeEntries(previous, entry, { keepForeignSource })
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

function mergeEntries(
	previous: Record<string, unknown>,
	entry: Record<string, unknown>,
	{ keepForeignSource = false } = {},
): Record<string, unknown>[] {
	const entries = Array.isArray(previous.plugins) ? [...(previous.plugins as unknown[])] : []
	const index = entries.findIndex(
		(candidate) =>
			typeof candidate === 'object' && candidate !== null && (candidate as Record<string, unknown>).name === entry.name,
	)
	if (index === -1) return [...entries, entry] as Record<string, unknown>[]
	const existing = entries[index] as Record<string, unknown>
	const merged = { ...existing, ...entry }
	if (!('version' in entry)) delete merged.version
	// A re-derivation describes the plugin, not where it is distributed from. An entry pointing at
	// an npm package keeps pointing there; only a caller that was asked for a new source replaces one.
	if (keepForeignSource && !isLocalCatalogSource(existing.source)) merged.source = existing.source
	entries[index] = merged
	return entries as Record<string, unknown>[]
}

/** Re-derives a whole catalog from discovery while keeping the entries discovery cannot see.
 *
 *  A repository may list plugins that live somewhere else — an npm package, a GitHub repository —
 *  put there by `marketplace add`. Nothing on disk produces those, so a regeneration that trusted
 *  discovery alone would report every one of them as a deletion, and `--force` would carry it out.
 *  Two things survive instead: an entry whose source is not local stays even though discovery never
 *  saw it, and a discovered plugin whose existing entry names a non-local source keeps that source
 *  with only its derived metadata refreshed.
 *
 *  That second case is the loss in issue #86 — a plugin shipped through npm, whose repository path
 *  holds only gitignored build output, rewritten to that path on every regeneration.
 *
 *  What discovery owns, it still owns: a local-path entry it no longer finds is dropped, so the
 *  catalog keeps mirroring the repository for the part of the repository it describes. */
export function mergeDiscoveredCatalog(
	generated: MarketplaceArtifact,
	existing: string | undefined,
): MarketplaceArtifact {
	if (existing === undefined) return generated
	let previous: Record<string, unknown>
	try {
		previous = parseCatalog(existing, generated.path)
	} catch {
		// A catalog that is not JSON has nothing to preserve, and refusing here would take away the
		// one command that repairs it: the conflict check stops the run, and `--force` rewrites it.
		return generated
	}

	const foreign = new Map<string, Record<string, unknown>>()
	for (const candidate of Array.isArray(previous.plugins) ? (previous.plugins as unknown[]) : []) {
		if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue
		const entry = candidate as Record<string, unknown>
		if (typeof entry.name !== 'string' || isLocalCatalogSource(entry.source)) continue
		foreign.set(entry.name, entry)
	}
	if (foreign.size === 0) return generated

	const catalog = JSON.parse(generated.content) as Record<string, unknown>
	const discovered = (catalog.plugins ?? []) as Record<string, unknown>[]
	const merged = discovered.map((entry) => {
		const kept = typeof entry.name === 'string' ? foreign.get(entry.name) : undefined
		return kept === undefined ? entry : { ...entry, source: kept.source }
	})
	// Discovered entries keep their name order and the kept ones follow in the order the catalog
	// already had them, so a second run of the same command produces the same file.
	const discoveredNames = new Set(discovered.map((entry) => entry.name))
	for (const [name, entry] of foreign) {
		if (!discoveredNames.has(name)) merged.push(entry)
	}
	catalog.plugins = merged
	return { path: generated.path, content: json(catalog) }
}

/** The plugin names a catalog lists, so a result row can report what the file ends up saying rather
 *  than only what discovery contributed to it. */
export function catalogEntryNames(content: string): string[] {
	try {
		const parsed = JSON.parse(content) as Record<string, unknown>
		if (!Array.isArray(parsed.plugins)) return []
		return parsed.plugins
			.map((entry) =>
				typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>).name : undefined,
			)
			.filter((name): name is string => typeof name === 'string')
	} catch {
		return []
	}
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
	return {
		path: catalogPath,
		content: json({ ...previous, plugins: mergeEntries(previous, entry, { keepForeignSource: true }) }),
	}
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
