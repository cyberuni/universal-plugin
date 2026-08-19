import { Command, Option } from 'commander'

import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { initializeMarketplace, type MarketplaceInitOptions } from './init.js'
import type { MarketplaceTarget } from './marketplace.js'
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
		.addCommand(initCommand())
		.addCommand(validateCommand())
}
