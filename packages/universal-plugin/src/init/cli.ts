import * as path from 'node:path'

import { Command, Option } from 'commander'

import { VENDOR_OUTPUT } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { type InitFs, realInitFs } from './fs.js'
import { type FileRow, planInit } from './init.js'

const NEXT_STEP = '→ add skills to skills/, then run universal-plugin plugin build\n'

interface InitCliOptions {
	name?: string
	vendor?: string[]
	scaffold?: boolean
	force?: boolean
	yes?: boolean
	npm?: boolean
	marketplace?: boolean
	root?: string
}

function collect(value: string, previous: string[]): string[] {
	return [...previous, value]
}

export function initCommand(deps: { fs: InitFs } = { fs: realInitFs }): Command {
	const cmd = new Command('init').description(
		'Scaffold the canonical plugin.json (with --npm, wire an npm package to ship it)',
	)

	cmd
		.option('--name <name>', 'Plugin name (default: the root directory name)')
		.option('--vendor <id>', 'Target vendor; repeatable', collect, [])
		.option('--scaffold', 'Create the standard skills/ agents/ governances/ commands/ directories')
		.option('--force', 'Overwrite an existing plugin.json')
		.option('--yes', 'Non-interactive (compatibility no-op; init never prompts)')
		.option('--npm', "Wire package.json 'files' to ship the derived vendor manifests")
		.option('--no-marketplace', "Skip the repository's local marketplace catalogs")
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin init --name my-plugin --scaffold\n')
		.action((opts: InitCliOptions) => {
			try {
				const root = resolveRoot(opts.root)
				const state = deps.fs.gather(root)
				const plan = planInit(
					state,
					{
						name: opts.name,
						vendors: opts.vendor ?? [],
						scaffold: Boolean(opts.scaffold),
						force: Boolean(opts.force),
						npm: Boolean(opts.npm),
						marketplace: opts.marketplace !== false,
					},
					path.basename(root),
					(vendor) => VENDOR_OUTPUT[vendor as keyof typeof VENDOR_OUTPUT],
				)

				deps.fs.apply(root, plan)

				const jsonResult = {
					created: plan.rows.filter((r) => r.action === 'created').map((r) => r.path),
					updated: plan.rows.filter((r) => r.action === 'updated').map((r) => r.path),
					summary: plan.summary,
				}
				output(jsonResult, {
					files: plan.rows.map((r: FileRow) => ({ path: r.path, action: r.action })),
					summary: `created ${plan.summary.created}, updated ${plan.summary.updated}, unchanged ${plan.summary.unchanged}`,
				})

				for (const note of plan.notes) process.stderr.write(`${note}\n`)
				process.stderr.write(NEXT_STEP)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}
