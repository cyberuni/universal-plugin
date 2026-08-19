import * as fs from 'node:fs'
import * as path from 'node:path'

import { Command, Option } from 'commander'

import { readManifest, universalPluginExtension, VENDOR_OUTPUT } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { loadRegistry } from '../vendor-registry/fs.js'
import { applyRemoval, applyWrite, readDestination, resolveLocalDir } from './fs.js'
import {
	destinationPath,
	type InstallMode,
	type PlanInput,
	planInstall,
	planUninstall,
	type VendorTarget,
} from './install.js'

interface InstallCliOptions {
	vendor?: string[]
	link?: boolean
	copy?: boolean
	force?: boolean
	list?: boolean
	root?: string
}

function collect(value: string, previous: string[]): string[] {
	return [...previous, value]
}

function resolveMode(opts: InstallCliOptions): InstallMode {
	if (opts.link && opts.copy) throw new Error('--link and --copy are mutually exclusive')
	if (opts.link) return 'link'
	if (opts.copy) return 'copy'
	return 'auto'
}

/** Gathers everything the pure planner needs: the plugin's name, the vendors it declares, each
 *  vendor's local-install facts, and what currently sits at each destination. */
function gather(root: string, opts: InstallCliOptions, mode: InstallMode): PlanInput {
	const manifest = readManifest(root)
	if (!manifest.name) throw new Error(`plugin.json at ${root} declares no name`)

	const uext = universalPluginExtension(manifest)
	// The declared target set is `plugin build`'s: the explicit `vendors` list, else every harnesses
	// key. Install never invents a target build does not know about.
	const declared = uext.vendors ?? Object.keys(uext.harnesses ?? {})
	const selected = opts.vendor?.length ? opts.vendor : declared
	for (const vendor of selected) {
		if (!declared.includes(vendor)) throw new Error(`Vendor "${vendor}" not declared in this plugin's manifest`)
	}
	if (selected.length === 0) throw new Error("No vendors declared in this plugin's manifest — nothing to install")

	const registry = loadRegistry()
	const targets: VendorTarget[] = selected.map((vendor) => {
		const config = registry[vendor]
		if (!config) throw new Error(`Unknown vendor: ${vendor}`)
		return {
			vendor,
			dir: resolveLocalDir(config.localPluginDir),
			link: config.localPluginLink,
			manifestPath: VENDOR_OUTPUT[vendor as keyof typeof VENDOR_OUTPUT] ?? 'plugin.json',
		}
	})

	const dest: Record<string, ReturnType<typeof readDestination>> = {}
	const manifests: Record<string, boolean> = {}
	for (const target of targets) {
		manifests[target.vendor] = fs.existsSync(path.join(root, target.manifestPath))
		if (target.dir !== null) dest[target.vendor] = readDestination(destinationPath(target.dir, manifest.name))
	}

	return { pluginName: manifest.name, root, mode, force: Boolean(opts.force), targets, dest, manifests }
}

/** The per-vendor step the runtime needs before it sees the change. Printed for every vendor the
 *  run actually touched — an install nothing reloads looks exactly like an install that failed. */
function reloadNotes(vendors: string[]): string[] {
	const registry = loadRegistry()
	return vendors
		.map((vendor) => {
			const reload = registry[vendor]?.localReload
			return reload ? `→ ${vendor}: ${reload}` : null
		})
		.filter((line): line is string => line !== null)
}

export function installCommand(): Command {
	const cmd = new Command('install').description(
		'Install this plugin into the runtimes it targets, for local development',
	)

	cmd
		.option('--vendor <id>', 'Install only the named vendor; repeatable', collect, [])
		.option('--link', 'Symlink the plugin root, failing a vendor that will not load one')
		.option('--copy', 'Copy the plugin root instead of linking it')
		.option('--force', 'Replace a destination this plugin does not own')
		.option('--list', 'Print the resolved targets and destinations without writing')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin install --vendor claude-code\n')
		.action((opts: InstallCliOptions) => {
			try {
				const root = resolveRoot(opts.root)
				const mode = resolveMode(opts)
				const input = gather(root, opts, mode)
				const plan = planInstall(input)

				if (!opts.list) {
					for (const write of plan.writes) applyWrite(root, write)
				}

				const { installed, unchanged, blocked, unsupported } = plan.summary
				output(plan, {
					vendors: plan.rows.map((r) => ({ vendor: r.vendor, path: r.path, action: r.action })),
					summary: `installed ${installed}, unchanged ${unchanged}, blocked ${blocked}, unsupported ${unsupported}`,
				})

				for (const row of plan.rows) {
					if (row.reason) process.stderr.write(`warn: ${row.vendor}: ${row.reason}\n`)
				}
				if (!opts.list) {
					for (const note of reloadNotes(plan.writes.map((w) => w.vendor))) process.stderr.write(`${note}\n`)
				}
				if (blocked > 0) process.exitCode = 1
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}

export function uninstallCommand(): Command {
	const cmd = new Command('uninstall').description('Remove this plugin from the runtimes it was installed into')

	cmd
		.option('--vendor <id>', 'Uninstall only the named vendor; repeatable', collect, [])
		.option('--force', 'Remove a destination this plugin does not own')
		.option('--list', 'Print what would be removed without removing it')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(new Option('--json').hideHelp())
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin uninstall\n')
		.action((opts: InstallCliOptions) => {
			try {
				const root = resolveRoot(opts.root)
				const plan = planUninstall(gather(root, opts, 'auto'))

				if (!opts.list) {
					for (const dest of plan.removals) applyRemoval(dest)
				}

				const { removed, missing, blocked, unsupported } = plan.summary
				output(plan, {
					vendors: plan.rows.map((r) => ({ vendor: r.vendor, path: r.path, action: r.action })),
					summary: `removed ${removed}, missing ${missing}, blocked ${blocked}, unsupported ${unsupported}`,
				})

				for (const row of plan.rows) {
					if (row.reason) process.stderr.write(`warn: ${row.vendor}: ${row.reason}\n`)
				}
				if (blocked > 0) process.exitCode = 1
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}
