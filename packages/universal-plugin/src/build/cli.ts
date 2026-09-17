import * as path from 'node:path'

import { Command, Option } from 'commander'

import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { type BuildResult, buildPlugin, type VendorRow } from './build.js'

// When nothing was derived, the natural follow-up is the skill that can say why (AXI #9, issue #61).
const NEXT_STEP_NOTHING_BUILT = '→ /universal-plugin:doctor-universal-plugin — diagnose why nothing is declared\n'
const NEXT_STEP_BUILT = '→ /universal-plugin:doctor-universal-plugin — check the built manifests against plugin.json\n'

/** Every hint names a command that exists today: an agent that follows a hint into
 *  `unknown command` is at a dead end (issue #80). A refreshed catalog is checked by
 *  `marketplace validate`, pointed at the repository the catalog lives in. */
function nextStep(result: BuildResult, cwd: string): string {
	if (result.vendors.length === 0) return NEXT_STEP_NOTHING_BUILT
	if (result.catalogRoot === undefined) return NEXT_STEP_BUILT
	const relative = path.relative(cwd, result.catalogRoot)
	const quoted = /\s/.test(relative) ? JSON.stringify(relative) : relative
	const root = relative === '' ? '' : ` --root ${quoted}`
	return `→ universal-plugin marketplace validate${root}\n`
}

/** What repairs a stale copy: the same build, without `--check`. */
function checkNextStep(root: string | undefined): string {
	return `\u2192 universal-plugin plugin build${root ? ` --root ${root}` : ''} \u2014 refresh the stale governance copies\n`
}

interface BuildCliOptions {
	vendor?: string
	dryRun?: boolean
	verbose?: boolean
	clean?: boolean
	check?: boolean
	root?: string
}

export function buildCommand(): Command {
	const cmd = new Command('build').description('Generate vendor manifests from plugin.json')

	cmd
		.option('--vendor <id>', 'Build only the named vendor')
		.option('--dry-run', 'Print what would be written without writing')
		.option('--verbose', 'Print field-by-field transformation decisions')
		.option('--clean', 'Delete generated manifests before building')
		.option('--check', 'Write nothing; fail when a committed governance copy differs from its source')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin build --vendor claude-code\n')
		.action((opts: BuildCliOptions) => {
			try {
				const root = resolveRoot(opts.root)
				const result = buildPlugin(root, {
					vendor: opts.vendor,
					dryRun: opts.dryRun,
					verbose: opts.verbose,
					clean: opts.clean,
					check: opts.check,
				})

				for (const warning of result.warnings) {
					process.stderr.write(`warn: ${warning}\n`)
				}

				// A governance copy is committed, so a build machine that finds one stale has found a
				// commit that never ran the build — a state the author has to repair, not this run.
				const stale = result.governances.filter((g) => g.status === 'stale')
				if (opts.check) {
					for (const copy of stale) {
						process.stderr.write(`stale: ${path.relative(process.cwd(), copy.path)} (owner ${copy.owner})\n`)
					}
				}

				const { built, skipped, failed, canonical } = result.summary
				const jsonResult = {
					governances: result.governances,
					built: result.rows.filter((r) => r.status === 'built'),
					skipped: result.rows.filter((r) => r.status === 'skipped'),
					failed: result.rows.filter((r) => r.status === 'failed'),
					canonical: result.rows.filter((r) => r.status === 'canonical'),
					catalogs: result.catalogs,
					summary: result.summary,
					warnings: result.warnings,
				}
				const counts = `built ${built}, skipped ${skipped}, failed ${failed}`
				const catalogSummary = result.catalogs.length > 0 ? `, catalogs ${result.catalogs.length}` : ''
				const governanceSummary =
					result.governances.length > 0 ? `, governance copies ${result.governances.length}` : ''
				output(jsonResult, {
					vendors: result.rows.map((r: VendorRow) => ({ vendor: r.vendor, path: r.path, status: r.status })),
					catalogs: result.catalogs.map((r) => ({ path: r.path, status: r.status })),
					// Omitted when the plugin declares none: an empty row set is noise on every build that
					// has no governance copies to report (AXI #5).
					...(result.governances.length > 0
						? { governances: result.governances.map((g) => ({ skill: g.skill, name: g.name, status: g.status })) }
						: {}),
					summary:
						(canonical > 0 ? `${counts}, served by plugin.json ${canonical}` : counts) +
						catalogSummary +
						governanceSummary,
				})

				process.stderr.write(
					opts.check && stale.length > 0 ? checkNextStep(opts.root) : nextStep(result, process.cwd()),
				)
				if (failed > 0) process.exitCode = 1
				if (opts.check && stale.length > 0) process.exitCode = 1
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}
