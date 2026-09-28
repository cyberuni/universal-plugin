export interface VendorConfig {
	sessionStartEvent: string
	projectManifest: string | null
	hookGlob: string | null
	pluginRootSuffix: string | null
	/** Directory a runtime scans for locally developed plugins, one entry per plugin, or `null` when
	 *  it has none. `plugin install` writes into it. Where `@cyberuni/agent-harness` knows a
	 *  harness's `local-plugins` folder, that value is used (see `withLocalPluginDirs`). */
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

/** Fills each vendor's `localPluginDir` from `locate`, which returns the harness's `local-plugins`
 *  folder when `@cyberuni/agent-harness` knows one. A vendor it knows nothing about keeps its
 *  registry value, or `null`. */
export function withLocalPluginDirs(
	registry: Record<string, Omit<VendorConfig, 'localPluginDir'> & { localPluginDir?: string | null }>,
	locate: (vendorId: string) => string | undefined,
): VendorRegistry {
	return Object.fromEntries(
		Object.entries(registry).map(([id, config]) => [
			id,
			{ ...config, localPluginDir: locate(id) ?? config.localPluginDir ?? null },
		]),
	)
}
