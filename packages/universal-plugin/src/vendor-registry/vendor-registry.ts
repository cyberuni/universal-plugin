export interface VendorConfig {
	sessionStartEvent: string
	globalManifest: string | null
	projectManifest: string | null
	hookGlob: string | null
	globalPluginDir: string | null
	pluginRootSuffix: string | null
	/** Directory a runtime scans for locally developed plugins, one entry per plugin, or `null` when
	 *  it has none. `plugin install` writes into it. */
	localPluginDir: string | null
	/** Whether that directory's scan follows a symlink whose target sits outside it. When false,
	 *  `plugin install` has to copy. */
	localPluginLink: boolean
	/** What the author has to do for the runtime to pick a fresh install up. */
	localReload: string | null
	installCommand: string | null
	removeCommand: string | null
	updateCommand: string | null
}

export type VendorRegistry = Record<string, VendorConfig>

export function lookupVendor(registry: VendorRegistry, vendorId: string): VendorConfig | null {
	return registry[vendorId] ?? null
}

export function mergeRegistries(base: VendorRegistry, override: VendorRegistry): VendorRegistry {
	const result: VendorRegistry = { ...base }
	for (const [id, config] of Object.entries(override)) {
		result[id] = { ...(base[id] ?? {}), ...config } as VendorConfig
	}
	return result
}
