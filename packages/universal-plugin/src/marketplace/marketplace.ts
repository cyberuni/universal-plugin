export type MarketplaceTarget = 'claude' | 'codex' | 'copilot' | 'cursor'
export type MarketplaceStatus = 'generated' | 'unchanged' | 'planned' | 'skipped-default' | 'empty'

export interface MarketplacePlugin {
	name: string
	source: string
	metadata: Record<string, unknown>
}

export interface MarketplaceMetadata {
	name: string
	owner: string
}

export interface MarketplaceArtifact {
	path: string
	content: string
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
		path: '.claude-plugin/marketplace.json',
		content: json({
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

function cursorArtifacts(metadata: MarketplaceMetadata, plugins: MarketplacePlugin[]): MarketplaceArtifact[] {
	const sources = plugins.map((plugin) => ({ name: plugin.name, source: plugin.source, ...commonMetadata(plugin) }))
	return [
		{
			path: '.cursor-plugin/marketplace-submission.json',
			content: json({ ...metadata, plugins: sources, dashboard: 'https://cursor.com/dashboard' }),
		},
		{
			path: 'CURSOR_MARKETPLACE_SUBMISSION.md',
			content: `# Cursor Marketplace Submission\n\nMarketplace: ${metadata.name}\nOwner: ${metadata.owner}\n\nPlugins:\n${sources.map((plugin) => `- ${plugin.name}: ${plugin.source}`).join('\n')}\n\nSubmit this metadata through the [Cursor dashboard](https://cursor.com/dashboard). This command generated local submission metadata only; no publication or provisioning occurred.\n`,
		},
	]
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
			return cursorArtifacts(metadata, plugins)
	}
}
