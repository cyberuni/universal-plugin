/** The shared metadata fields the Agent Plugins Specification allows in more forms than a runtime
 *  accepts (issue #260). Each rule below is what the runtime's own loader or validator does, recorded
 *  in `skills/init-universal-plugin/references/vendors/<vendor>.md`:
 *
 *  - Claude Code (`claude plugin validate`) and Cursor (its bundled manifest schema) take `repository`
 *    as a string only, and require `author.name`. A manifest that breaks either is not loaded.
 *  - Codex, when the canonical manifest carries an Agent Plugins `$schema`, reads the canonical
 *    `plugin.json` itself and types `repository` as a string, so an object there fails the load. No
 *    derived file can repair that; only the canonical manifest can. Its legacy `.codex-plugin` loader
 *    does not read `repository` or `author`.
 *  - Copilot CLI reads the canonical manifest and accepts every form the spec allows.
 *
 *  `keywords` is a string array everywhere, which is all the spec allows. */

type Vendor = 'claude-code' | 'cursor' | 'codex' | 'copilot-cli'

/** Derived manifests whose runtime takes `repository` as a URL string only. Codex's legacy loader
 *  ignores the field, so a string there is harmless and keeps every derived manifest one shape. */
const STRING_REPOSITORY: ReadonlySet<Vendor> = new Set(['claude-code', 'cursor', 'codex'])

/** Derived manifests whose runtime rejects an `author` without a `name`. */
const NAMED_AUTHOR: ReadonlySet<Vendor> = new Set(['claude-code', 'cursor'])

/** Codex reads root `plugin.json` as its manifest whenever `$schema` starts with this prefix
 *  (`codex-rs/utils/plugins/src/plugin_namespace.rs`, `agent_plugin_schema_status`). */
const CODEX_AGENT_PLUGINS_SCHEMA_PREFIX = 'https://agent-plugins.org/schemas/'

export interface MetadataDelivery {
	/** The metadata as this vendor's derived manifest should carry it. */
	metadata: Record<string, unknown>
	/** One line per field the build rewrote, for `--verbose`. */
	conversions: string[]
	/** One line per field this vendor cannot accept, naming the field, the vendor, and the fix. */
	warnings: string[]
}

/** Rewrites the canonical metadata into the form `vendor`'s derived manifest accepts. A field the
 *  author sets under `harnesses.<vendor>` (`overridden`) is theirs to shape and is left alone. */
export function deliverMetadata(
	metadata: Record<string, unknown>,
	vendor: Vendor,
	overridden: ReadonlySet<string> = new Set(),
): MetadataDelivery {
	const delivered = { ...metadata }
	const conversions: string[] = []
	const warnings: string[] = []

	const repository = metadata['repository']
	if (STRING_REPOSITORY.has(vendor) && !overridden.has('repository') && isObject(repository)) {
		if (typeof repository['url'] === 'string') {
			delivered['repository'] = repository['url']
			conversions.push('repository: the { type, url } object is written as its url string')
		} else {
			delete delivered['repository']
			warnings.push(
				`${vendor} accepts repository only as a URL string, and the repository object in plugin.json has no url — left out of the derived manifest; write repository as the URL string in plugin.json`,
			)
		}
	}

	const author = metadata['author']
	if (NAMED_AUTHOR.has(vendor) && !overridden.has('author') && isObject(author) && !nonEmptyString(author['name'])) {
		delete delivered['author']
		warnings.push(
			`${vendor} rejects an author without a name — left out of the derived manifest; set author.name in plugin.json`,
		)
	}

	return { metadata: delivered, conversions, warnings }
}

/** Warnings for the runtimes that read the canonical manifest itself, where the build has no derived
 *  file to repair a field in. */
export function canonicalMetadataWarnings(manifest: Record<string, unknown>, vendors: readonly Vendor[]): string[] {
	const warnings: string[] = []
	const schema = manifest['$schema']
	if (
		vendors.includes('codex') &&
		typeof schema === 'string' &&
		schema.startsWith(CODEX_AGENT_PLUGINS_SCHEMA_PREFIX) &&
		isObject(manifest['repository'])
	) {
		warnings.push(
			'codex reads the canonical plugin.json and rejects repository as an object, so it will not load this plugin — write repository as the URL string in plugin.json',
		)
	}
	return warnings
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): boolean {
	return typeof value === 'string' && value.trim().length > 0
}
