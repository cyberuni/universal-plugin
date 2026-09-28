import * as path from 'node:path'

import { type HarnessId, harnessIds } from '@cyberuni/agent-harness'
import { Command, Option } from 'commander'

import { loadRegistry } from '../vendor-registry/fs.js'
import { lookupVendor } from '../vendor-registry/vendor-registry.js'
import { populateStoreFromVendorCache, realPrepareFs } from './fs.js'
import { runPrepare } from './prepare.js'

export function prepareCommand(): Command {
	return new Command('prepare')
		.description('Detect cross-vendor plugin sync actions')
		.argument('<vendor-id>', 'Vendor to read manifest from (e.g. claude-code)')
		.addOption(new Option('--scope <scope>', 'global or project').default('global').choices(['global', 'project']))
		.option('--root <path>', 'Project root for project-scope state file')
		.option('--dry-run', 'Print action count without writing state')
		.action((vendorId: string, opts: { scope: string; root?: string; dryRun?: boolean }) => {
			const registry = loadRegistry()
			const vendor = lookupVendor(registry, vendorId)
			if (!vendor || !harnessIds.includes(vendorId as HarnessId)) {
				process.stderr.write(`Unknown vendor: ${vendorId}\n`)
				process.exit(1)
			}
			if (opts.scope === 'project' && !opts.root) {
				process.stderr.write('--root is required when --scope is project\n')
				process.exit(1)
			}
			const now = new Date().toISOString()
			const scope = opts.scope as 'global' | 'project'
			const projectRoot = opts.root ? path.resolve(opts.root) : undefined
			const prepareFs = realPrepareFs(vendorId as HarnessId, { scope, projectRoot })
			const pluginRoots = prepareFs.readPluginRoots()
			const manifest = prepareFs.readManifest()
			const { newActionCount } = runPrepare({
				vendorId,
				scope,
				fs: prepareFs,
				now,
				dryRun: opts.dryRun,
			})
			populateStoreFromVendorCache(pluginRoots, manifest)
			if (newActionCount > 0) {
				process.stdout.write(`${newActionCount} plugin sync action(s) pending. Run /sync to review.\n`)
			}
		})
}
