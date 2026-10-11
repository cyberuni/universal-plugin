import * as path from 'node:path'

import { Command } from 'commander'

import { readManifest, universalPluginExtension } from '../build/build.js'
import { ROOT_OPTION, resolveRoot } from '../cli-options.js'
import { output } from '../output.js'
import { discoverWorkspace, realPinFs, realVersionSource, resolveSkillsDir } from '../pin/fs.js'
import type { StampedPin } from '../pin/stamp.js'
import { stampPins } from '../pin/stamp.js'
import { writeJsonFile } from '../version/fs.js'
import { PINS_MAP_PATH, pinsMap } from '../version/version.js'

const TRUNCATE_THRESHOLD = 20
const NEXT_STEP = '→ review and commit the pinned skills\n'

interface BundleCliOptions {
	dryRun?: boolean
	full?: boolean
	root?: string
	runner?: string
}

export function bundleCommand(): Command {
	// Deprecated (#179): `plugin version` stamps the skills' pins along with every other place the
	// version lives. Kept as a warning alias for one minor release.
	const cmd = new Command('bundle').description('Deprecated: use `plugin version`, which stamps the skill pins')

	cmd
		.option('--dry-run', 'Resolve and report pins without writing them')
		.option('--full', 'Show every pins row without truncation')
		.option('--format <format>', 'Output format: json or toon (default: toon)')
		.option(
			'--runner <runner>',
			"Runner word to emit on rewritten refs: npx or upx (default: preserve each ref's runner)",
		)
		.addOption(ROOT_OPTION)
		.addHelpText('after', '\nExample:\n  $ universal-plugin plugin bundle --dry-run --full\n')
		.action((opts: BundleCliOptions) => {
			process.stderr.write(
				'warn: plugin bundle is deprecated and will be removed in the next minor release — use plugin version, which stamps the skill pins\n',
			)
			try {
				const runner = opts.runner
				if (runner !== undefined && runner !== 'npx' && runner !== 'upx') {
					throw new Error(`error: unknown --runner value "${runner}" (expected npx or upx)`)
				}

				const root = resolveRoot(opts.root)
				const manifest = readManifest(root)
				const skillsDir = resolveSkillsDir(root, universalPluginExtension(manifest).skills as string | undefined)
				const pinFs = realPinFs(skillsDir)
				const versionSource = realVersionSource(discoverWorkspace(root))

				const result = stampPins(pinFs, versionSource, { dryRun: opts.dryRun, runner })

				if (!opts.dryRun) writeJsonFile(path.join(root, PINS_MAP_PATH), pinsMap(result.pins))

				for (const warning of result.warnings) {
					process.stderr.write(`warn: ${warning}\n`)
				}

				const pinned = result.pins.filter((p) => p.status === 'pinned').length
				const unchanged = result.pins.filter((p) => p.status === 'unchanged').length
				const skipped = result.pins.filter((p) => p.status === 'skipped').length

				const truncated = !opts.full && result.pins.length > TRUNCATE_THRESHOLD
				const shown = truncated ? result.pins.slice(0, TRUNCATE_THRESHOLD) : result.pins
				output(
					{ pins: result.pins },
					{
						pins: shown.map((r: StampedPin) => ({
							package: r.package,
							current: r.current,
							resolved: r.resolved,
							status: r.status,
						})),
						...(truncated
							? { truncated: `… +${result.pins.length - TRUNCATE_THRESHOLD} more — rerun with --full` }
							: {}),
						summary: `pinned ${pinned}, unchanged ${unchanged}, skipped ${skipped}`,
					},
				)

				if (result.pins.length === 0) {
					process.stderr.write('nothing to bundle\n')
				}
				process.stderr.write(NEXT_STEP)
			} catch (err) {
				process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
				process.exit(1)
			}
		})

	return cmd
}
