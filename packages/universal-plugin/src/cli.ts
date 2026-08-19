#!/usr/bin/env node
import { Command } from 'commander'

import { cleanCommand } from './asset-store/cli.js'
import { buildCommand } from './build/cli.js'
import { bundleCommand } from './bundle/cli.js'
import { configCommand } from './config/cli.js'
import { governanceCommand } from './governance/cli.js'
import { initCommand } from './init/cli.js'
import { installCommand, uninstallCommand } from './install/cli.js'
import { marketplaceCommand } from './marketplace/cli.js'
import { prepareCommand } from './prepare/cli.js'
import { publishCommand } from './publish/cli.js'
import { selfUpdateCommand } from './self-update/cli.js'
import { syncCommand } from './sync/cli.js'
import { versionCommand } from './version/cli.js'

const program = new Command()

program.name('universal-plugin').description('Universal AI agent plugin build tool').version('0.0.0').helpCommand(false)

// The `plugin` command group: author the canonical plugin.json.
// build, bundle, init, install, uninstall, and version are implemented; validate is specced (impl-deferred).
function pluginCommand(): Command {
	const cmd = new Command('plugin').description(
		'Author the canonical plugin manifest (build, bundle, init, install, uninstall, version; validate planned)',
	)
	cmd.addCommand(buildCommand())
	cmd.addCommand(bundleCommand())
	cmd.addCommand(initCommand())
	cmd.addCommand(installCommand())
	cmd.addCommand(uninstallCommand())
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
