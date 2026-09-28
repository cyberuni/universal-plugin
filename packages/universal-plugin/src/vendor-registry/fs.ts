import * as fsNode from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { type HarnessId, harnessIds, pluginStorage } from '@cyberuni/agent-harness'

import type { VendorRegistry } from './vendor-registry.js'
import { mergeRegistries, withLocalPluginDirs } from './vendor-registry.js'

function bundledRegistryPath(): string {
	const thisFile = fileURLToPath(import.meta.url)
	return path.join(path.dirname(thisFile), 'data', 'vendors.json')
}

function userOverridePath(): string {
	return path.join(os.homedir(), '.agents', 'universal-plugin-vendors.json')
}

/** The harness's `local-plugins` folder, as `@cyberuni/agent-harness` locates it. */
function localPluginsDir(vendorId: string): string | undefined {
	if (!harnessIds.includes(vendorId as HarnessId)) return undefined
	return pluginStorage(vendorId as HarnessId).locations.find((l) => l.kind === 'local-plugins')?.path
}

/** The bundled registry, with the per-harness facts `@cyberuni/agent-harness` owns filled in, then
 *  the user's override on top. */
export function loadRegistry(): VendorRegistry {
	const bundled = withLocalPluginDirs(
		JSON.parse(fsNode.readFileSync(bundledRegistryPath(), 'utf8')) as Parameters<typeof withLocalPluginDirs>[0],
		localPluginsDir,
	)
	try {
		const override = JSON.parse(fsNode.readFileSync(userOverridePath(), 'utf8')) as VendorRegistry
		return mergeRegistries(bundled, override)
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return bundled
		throw err
	}
}
