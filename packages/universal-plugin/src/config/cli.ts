import { Command } from 'commander'

import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { addEntry, getEntries, getPackagePath, isReservedKey } from './config.js'
import { type ConfigFs, realConfigFs } from './fs.js'

interface AddCliOptions {
	key: string
	entry: string
	root?: string
}

interface GetCliOptions {
	key: string
	root?: string
}

function assertNotReserved(key: string): void {
	if (isReservedKey(key)) {
		throw new Error(
			`error: "${key}" is a reserved key (universal-plugin's own config) — not a plugin-registered array; edit .agents/universal-plugin.json directly`,
		)
	}
}

function addCommand(fs: ConfigFs): Command {
	return new Command('add')
		.description('Register (append or replace-by-name) an entry in the array at a config key')
		.requiredOption('--key <key>', 'The config key whose array to write')
		.requiredOption('--entry <json>', 'The entry object as JSON (must include a "name" field)')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(ROOT_OPTION)
		.addHelpText(
			'after',
			'\nExample:\n  $ universal-plugin config add --key sdd-plugins --entry \'{"name":"aces","handles":["agent evaluation"]}\'\n',
		)
		.action((opts: AddCliOptions) => {
			try {
				assertNotReserved(opts.key)

				let parsed: unknown
				try {
					parsed = JSON.parse(opts.entry)
				} catch {
					throw new Error('error: --entry is not valid JSON')
				}

				const root = resolveRoot(opts.root)
				const config = fs.read(root)
				const result = addEntry(config, opts.key, parsed)
				fs.write(root, result.config)

				const count = getEntries(result.config, opts.key).length
				output(
					{ key: opts.key, name: result.name, action: result.action },
					{ key: opts.key, name: result.name, action: result.action, summary: `${opts.key}: ${count} entries` },
				)

				process.stderr.write(`→ universal-plugin config get --key ${opts.key}\n`)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})
}

function getCommand(fs: ConfigFs): Command {
	return new Command('get')
		.description('Read the array of entries registered at a config key, or the packagePath string')
		.requiredOption('--key <key>', 'The config key whose array to read (or packagePath)')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin config get --key sdd-plugins\n')
		.action((opts: GetCliOptions) => {
			try {
				const root = resolveRoot(opts.root)

				// `packagePath` is the CLI's own string config, not an array: read it as the string it is, so
				// a skill asks the CLI where the npm package lives instead of re-reading the file (issue #79).
				if (opts.key === 'packagePath') {
					const packagePath = getPackagePath(fs.read(root))
					output(packagePath, {
						packagePath: packagePath ?? '(none)',
						relativeTo: 'plugin root',
						summary: packagePath === null ? 'no npm package declared' : `npm package at ${packagePath}`,
					})
					process.stderr.write(
						packagePath === null
							? '→ set packagePath in .agents/universal-plugin.json to ship through npm\n'
							: '→ universal-plugin publish sync-version\n',
					)
					return
				}

				assertNotReserved(opts.key)
				const entries = getEntries(fs.read(root), opts.key)

				output(entries, {
					names: (entries as Record<string, unknown>[]).map((e) => String(e.name ?? '')),
					summary: `${opts.key}: ${entries.length} entries`,
				})

				process.stderr.write(`→ universal-plugin config add --key ${opts.key} --entry <json>\n`)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})
}

export function configCommand(fs: ConfigFs = realConfigFs): Command {
	return new Command('config')
		.description('Read and write plugin-registered config in .agents/universal-plugin.json')
		.addCommand(addCommand(fs))
		.addCommand(getCommand(fs))
}
