import { Command, Option } from 'commander'

import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { addToMarketplace, ENTRY_METADATA_FIELDS, type MarketplaceAddOptions } from './add.js'
import { initializeMarketplace, type MarketplaceInitOptions } from './init.js'
import type { MarketplaceTarget } from './marketplace.js'
import type { SourceKind } from './spec.js'
import { validateMarketplace } from './validate.js'
import { formatCatalogIssues } from './validation.js'

interface MarketplaceCliOptions extends MarketplaceInitOptions {
	claude?: boolean
	codex?: boolean
	copilot?: boolean
	cursor?: boolean
	root?: string
	pluginScanDir?: string[]
	format?: string
}

function targetsFromOptions(opts: MarketplaceCliOptions): MarketplaceTarget[] | undefined {
	const targets = (['claude', 'codex', 'copilot', 'cursor'] as const).filter((target) => opts[target])
	return targets.length > 0 ? targets : undefined
}

interface AddCliOptions extends MarketplaceCliOptions {
	path?: boolean
	npm?: boolean
	github?: boolean
	url?: boolean
	fromMarketplace?: boolean
	from?: string
	description?: string
	version?: string
	homepage?: string
	repository?: string
	license?: string
	keywords?: string
	marketplaceName?: string
	owner?: string
}

/** The kind flags, as one map, so a second one is an error rather than a silent precedence rule. */
const KIND_FLAGS: Record<string, SourceKind> = {
	path: 'path',
	npm: 'npm',
	github: 'github',
	url: 'url',
	fromMarketplace: 'marketplace',
}

function kindFromOptions(opts: AddCliOptions): SourceKind | undefined {
	const named = Object.keys(KIND_FLAGS).filter((flag) => opts[flag as keyof AddCliOptions])
	if (named.length > 1) throw new Error(`error: pass one source kind, not ${named.length}`)
	return named.length === 1 ? KIND_FLAGS[named[0] as string] : undefined
}

function metadataFromOptions(opts: AddCliOptions): MarketplaceAddOptions['metadata'] {
	const metadata: Record<string, unknown> = {}
	for (const field of ENTRY_METADATA_FIELDS) {
		const value = opts[field as keyof AddCliOptions]
		if (typeof value !== 'string') continue
		metadata[field] =
			field === 'keywords'
				? value
						.split(',')
						.map((keyword) => keyword.trim())
						.filter((keyword) => keyword !== '')
				: value
	}
	return metadata
}

function addCommand(): Command {
	return new Command('add')
		.description("List a plugin that lives elsewhere in this repository's marketplace catalogs")
		.argument(
			'<spec>',
			'What to list: ./path, owner/repo, a git URL, an npm package (npm:<pkg>), or <plugin>@<marketplace>',
		)
		.option('--claude', 'Write the Claude marketplace catalog')
		.option('--codex', 'Write the Codex marketplace catalog')
		.option('--copilot', 'Write the Copilot marketplace catalog')
		.option('--cursor', 'Write the Cursor marketplace catalog')
		.option('--path', 'Read the spec as a repository-relative path')
		.option('--npm', 'Read the spec as an npm package name')
		.option('--github', 'Read the spec as an owner/repo GitHub repository')
		.option('--url', 'Read the spec as a git or https URL')
		.option('--from-marketplace', 'Read the spec as <plugin>@<marketplace>')
		.option('--from <dir>', 'Directory holding the marketplace to copy an entry from')
		.option('--name <name>', 'Entry name, when it differs from the one the spec implies')
		.option('--description <text>', 'Entry description')
		.option('--version <version>', 'Entry version')
		.option('--homepage <url>', 'Entry homepage')
		.option('--repository <url>', 'Entry repository URL')
		.option('--license <id>', 'Entry license')
		.option('--keywords <list>', 'Entry keywords, comma-separated')
		.option('--marketplace-name <name>', 'Name for the catalog, when this command has to create one')
		.option('--owner <name>', 'Owner for the catalog, when this command has to create one')
		.option('--dry-run', 'Preview the entry without writing it')
		.option('--force', 'Replace an entry of this name that is already listed differently')
		.option('--format <format>', 'Output format: toon or json (default: toon)')
		.addOption(ROOT_OPTION)
		.addHelpText(
			'after',
			'\nExamples:\n' +
				'  $ universal-plugin marketplace add npm:repobuddy\n' +
				'  $ universal-plugin marketplace add cyberuni/universal-plugin\n' +
				'  $ universal-plugin marketplace add repobuddy@cyberplace --dry-run\n',
		)
		.action((spec: string, opts: AddCliOptions) => {
			try {
				if (opts.format !== undefined && opts.format !== 'toon' && opts.format !== 'json') {
					throw new Error('error: --format must be "toon" or "json"')
				}
				const results = addToMarketplace(resolveRoot(opts.root), spec, {
					targets: targetsFromOptions(opts),
					kind: kindFromOptions(opts),
					name: opts.name,
					from: opts.from,
					metadata: metadataFromOptions(opts),
					marketplaceName: opts.marketplaceName,
					owner: opts.owner,
					dryRun: opts.dryRun,
					force: opts.force,
				})
				output(results, {
					targets: results.map((row) => ({
						target: row.target,
						status: row.status,
						entry: row.entry,
						source: row.source,
						path: row.path,
						reason: row.reason ?? '-',
					})),
					summary: `${results.filter((row) => row.status === 'skipped').length} skipped of ${results.length}`,
				})
				for (const row of results.filter((row) => row.status === 'skipped')) {
					process.stderr.write(`skipped ${row.target}: ${row.reason}\n`)
				}
				process.stderr.write(
					`${opts.dryRun ? 'Planned' : 'Wrote'} repository metadata only; no marketplace publication, registration, installation, authentication, or provisioning occurred.\n`,
				)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exitCode = 1
			}
		})
}

function initCommand(): Command {
	return new Command('init')
		.description('Generate local marketplace metadata without publishing or provisioning')
		.option('--claude', 'Generate the Claude marketplace catalog')
		.option('--codex', 'Generate the Codex marketplace catalog')
		.option('--copilot', 'Generate the Copilot marketplace catalog')
		.option('--cursor', 'Generate the Cursor marketplace catalog')
		.option(
			'--plugin-scan-dir <dir>',
			'Directory beneath --root to scan for root-level plugin.json files (repeatable)',
			(value: string, previous: string[] = []) => [...previous, value],
		)
		.option('--name <name>', 'Override the marketplace name')
		.option('--owner <name>', 'Override the marketplace owner')
		.option('--dry-run', 'Preview artifacts without writing them')
		.option('--force', 'Replace differing artifacts for selected targets')
		.option('--format <format>', 'Output format: toon or json (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin marketplace init --root .\n')
		.action((opts: MarketplaceCliOptions) => {
			try {
				if (opts.format !== undefined && opts.format !== 'toon' && opts.format !== 'json') {
					throw new Error('error: --format must be "toon" or "json"')
				}
				const results = initializeMarketplace(resolveRoot(opts.root), {
					targets: targetsFromOptions(opts),
					scanDirs: opts.pluginScanDir,
					name: opts.name,
					owner: opts.owner,
					dryRun: opts.dryRun,
					force: opts.force,
				})
				output(results, {
					targets: results.map((row) => ({
						target: row.target,
						status: row.status,
						paths: row.paths.join(' ') || '-',
						plugins: row.plugins.join(' ') || '-',
					})),
					summary: `${results.length} targets`,
				})
				process.stderr.write(
					'Generated repository metadata only; no marketplace publication, registration, installation, authentication, or provisioning occurred.\n',
				)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exitCode = 1
			}
		})
}

function validateCommand(): Command {
	return new Command('validate')
		.description('Check the repository-local marketplace catalogs against the schema each runtime loads')
		.option('--claude', 'Validate the Claude marketplace catalog')
		.option('--codex', 'Validate the Codex marketplace catalog')
		.option('--copilot', 'Validate the Copilot marketplace catalog')
		.option('--cursor', 'Validate the Cursor marketplace catalog')
		.option('--required', 'Treat a selected target with no catalog as a failure')
		.option('--format <format>', 'Output format: toon or json (default: toon)')
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin marketplace validate --claude\n')
		.action((opts: MarketplaceCliOptions & { required?: boolean }) => {
			try {
				if (opts.format !== undefined && opts.format !== 'toon' && opts.format !== 'json') {
					throw new Error('error: --format must be "toon" or "json"')
				}
				const results = validateMarketplace(resolveRoot(opts.root), {
					targets: targetsFromOptions(opts),
					required: opts.required,
				})
				output(results, {
					targets: results.map((row) => ({
						target: row.target,
						status: row.status,
						path: row.path,
						issues: row.issues.length,
					})),
					summary: `${results.filter((row) => row.status === 'invalid').length} invalid of ${results.length}`,
				})
				// Every issue on stderr, one line each, so a failure names the key to fix rather than a count.
				for (const row of results.filter((row) => row.status === 'invalid')) {
					process.stderr.write(formatCatalogIssues(row.path, row.issues))
					process.stderr.write('\n')
				}
				if (results.some((row) => row.status === 'invalid')) process.exitCode = 1
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exitCode = 1
			}
		})
}

export function marketplaceCommand(): Command {
	return new Command('marketplace')
		.description('Generate repository-local marketplace metadata')
		.addCommand(addCommand())
		.addCommand(initCommand())
		.addCommand(validateCommand())
}
