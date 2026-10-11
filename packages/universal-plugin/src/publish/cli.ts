import * as path from 'node:path'

import { Command } from 'commander'

import { buildPlugin, readManifest, universalPluginExtension } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { realPinFs, resolveSkillsDir } from '../pin/fs.js'
import { realSyncVersionFs } from './fs.js'
import { syncSkillPins, syncVersion } from './sync-version.js'

export function publishCommand(): Command {
	const cmd = new Command('publish').description('Prepare plugin for publishing').helpCommand(false)

	cmd
		.command('sync-version')
		.description(
			"Sync version from packagePath/package.json (default: the plugin root) into plugin.json and the skills' pins of that package",
		)
		.option('--no-build', 'Skip re-deriving the vendor manifests')
		.addOption(ROOT_OPTION)
		.action((opts: { root?: string; build?: boolean }) => {
			try {
				const root = resolveRoot(opts.root)
				const { packageName, ...result } = syncVersion(root, realSyncVersionFs)

				// The skills' `npx`/`upx <pkg>@<version>` pins of this package are derived too, so they move
				// with the version rather than waiting for a separate `plugin bundle` run (#164).
				const pinned: string[] = []
				if (packageName !== null) {
					const skillsDir = resolveSkillsDir(
						root,
						universalPluginExtension(readManifest(root)).skills as string | undefined,
					)
					for (const pin of syncSkillPins(realPinFs(skillsDir), packageName, result.version)) {
						if (pin.status === 'pinned') pinned.push(pin.package)
					}
				}

				// The same re-derivation `plugin version` runs after its bump, so the vendor manifests carry
				// the synced version and the two directions of the version flow cannot drift (#143).
				const derived: string[] = []
				if (opts.build !== false) {
					const build = buildPlugin(root, {})
					for (const warning of build.warnings) {
						process.stderr.write(`warn: ${warning}\n`)
					}
					for (const written of build.written) {
						derived.push(path.relative(root, written).split(path.sep).join('/'))
					}
				}

				output(
					{ ...result, derived, pinned },
					{ version: result.version, manifest: result.manifestPath, derived, pinned },
				)
				if (opts.build === false) process.stderr.write('→ universal-plugin plugin build\n')
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}
