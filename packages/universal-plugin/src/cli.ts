#!/usr/bin/env node
import { fileURLToPath } from 'node:url'

import { Command } from 'commander'

import { cleanCommand } from './asset-store/cli.js'
import { buildCommand } from './build/cli.js'
import { bundleCommand } from './bundle/cli.js'
import { resolveOwnVersion } from './cli-options.js'
import { configCommand } from './config/cli.js'
import { governanceCommand } from './governance/cli.js'
import { initCommand } from './init/cli.js'
import { installCommand, uninstallCommand } from './install/cli.js'
import { marketplaceCommand } from './marketplace/cli.js'
import { prepareCommand } from './prepare/cli.js'
import { publishCommand } from './publish/cli.js'
import { selfUpdateCommand } from './self-update/cli.js'
import { syncCommand } from './sync/cli.js'
import { addValidateOptions, runValidate, validateCommand } from './validate/cli.js'
import { versionCommand } from './version/cli.js'

const program = new Command()

// This bundle ships beside its own `package.json` in both the source tree (`src/cli.ts` next to
// `package.json`) and the published npm package (`dist/cli.mjs` one level under it), so `../package.json`
// resolves the same way in both.
const ownPackageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))

program
	.name('universal-plugin')
	.description('Universal AI agent plugin build tool')
	.version(resolveOwnVersion(ownPackageJsonPath))
	.helpCommand(false)
	// Commander hands a subcommand's arguments to the `plugin` group before the subcommand name unless
	// every ancestor reads its options positionally, so the group's `--root` would swallow build's.
	.enablePositionalOptions()

// The `plugin` command group: author the canonical plugin.json. Bare `plugin` is content-first: it
// validates the current project and lists the declared harnesses instead of printing help.
function pluginCommand(): Command {
	const cmd = addValidateOptions(
		new Command('plugin').description(
			'Author the canonical plugin manifest (build, bundle, init, install, uninstall, validate, version)',
		),
	)
		// The group's own options are read only before a subcommand, so `plugin build --root` stays build's.
		.enablePositionalOptions()
		.addHelpText('after', '\nWith no subcommand, validates the current project.\n')
		.action((opts) => runValidate(opts, { withHarnesses: true }))
	cmd.addCommand(buildCommand())
	cmd.addCommand(bundleCommand())
	cmd.addCommand(initCommand())
	cmd.addCommand(installCommand())
	cmd.addCommand(uninstallCommand())
	cmd.addCommand(validateCommand())
	cmd.addCommand(versionCommand())
	return cmd
}

program.addCommand(pluginCommand())
program.addCommand(cleanCommand())
program.addCommand(configCommand())
program.addCommand(governanceCommand())
program.addCommand(marketplaceCommand())
program.addCommand(prepareCommand())
program.addCommand(publishCommand())
program.addCommand(syncCommand())
program.addCommand(selfUpdateCommand())

program.parseAsync(process.argv).catch((err: unknown) => {
	process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
	process.exit(1)
})
