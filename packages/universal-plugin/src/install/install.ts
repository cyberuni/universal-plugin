/** Pure domain for `plugin install` / `plugin uninstall` — putting the plugin under development
 *  into a runtime, and taking it back out.
 *
 *  No I/O: the caller resolves each vendor's local plugin directory, reads what currently occupies
 *  the destination, and applies the returned plan. The rules live here — how a mode resolves per
 *  vendor, what counts as our own install, and when a destination is refused. */

import * as path from 'node:path'

/** How the plugin is placed. `auto` links where the vendor loads an out-of-tree symlink and copies
 *  where it does not, so the default works everywhere without silently doing the wrong thing. */
export type InstallMode = 'auto' | 'link' | 'copy'

/** One vendor's local-install facts, read from the vendor registry. */
export interface VendorTarget {
	vendor: string
	/** Absolute local plugin directory, or `null` when the vendor has none. */
	dir: string | null
	/** Whether the vendor loads a symlink whose target sits outside `dir`. */
	link: boolean
	/** The derived manifest this vendor reads, relative to the plugin root. */
	manifestPath: string
}

/** What currently occupies a destination. `target` is a symlink's resolved path; `pluginName` is
 *  the `name` of a `plugin.json` found inside a directory, absent when there is none. */
export interface DestState {
	kind: 'absent' | 'symlink' | 'directory' | 'file'
	target?: string
	pluginName?: string | null
}

export interface PlanInput {
	pluginName: string
	/** The plugin root, absolute and already resolved. */
	root: string
	mode: InstallMode
	force: boolean
	targets: VendorTarget[]
	/** Destination state per vendor id. */
	dest: Record<string, DestState>
	/** Whether each vendor's derived manifest is present, per vendor id. */
	manifests: Record<string, boolean>
}

export type InstallAction = 'linked' | 'copied' | 'unchanged' | 'blocked' | 'unsupported'
export type UninstallAction = 'removed' | 'missing' | 'blocked' | 'unsupported'

export interface InstallRow {
	vendor: string
	path: string
	action: InstallAction
	reason?: string
}

export interface UninstallRow {
	vendor: string
	path: string
	action: UninstallAction
	reason?: string
}

export interface Write {
	vendor: string
	dest: string
	mode: 'link' | 'copy'
	/** Whether the destination has to be removed first. */
	replace: boolean
}

export interface InstallPlan {
	rows: InstallRow[]
	writes: Write[]
	summary: { installed: number; unchanged: number; blocked: number; unsupported: number }
}

export interface UninstallPlan {
	rows: UninstallRow[]
	removals: string[]
	summary: { removed: number; missing: number; blocked: number; unsupported: number }
}

/** The destination this plugin occupies in a vendor's local plugin directory. */
export function destinationPath(dir: string, pluginName: string): string {
	return path.join(dir, pluginName)
}

/** Whether a destination holds this plugin already — our symlink back to the root, or a directory
 *  carrying this plugin's canonical manifest. Anything else belongs to someone else. */
function isOurs(state: DestState, root: string, pluginName: string): boolean {
	if (state.kind === 'symlink') return state.target === root
	if (state.kind === 'directory') return state.pluginName === pluginName
	return false
}

function occupiedReason(state: DestState): string {
	if (state.kind === 'symlink') return `a symlink to ${state.target} is already there; --force replaces it`
	if (state.kind === 'directory') return 'another plugin is already installed there; --force replaces it'
	return 'a file is already there; --force replaces it'
}

/** The mode a vendor actually gets. Returns `null` when `--link` was demanded of a vendor that
 *  rejects an out-of-tree symlink — the caller reports that as blocked rather than silently
 *  copying, since the author asked for a live link and would not get one. */
function resolveMode(mode: InstallMode, target: VendorTarget): 'link' | 'copy' | null {
	if (mode === 'copy') return 'copy'
	if (target.link) return 'link'
	return mode === 'link' ? null : 'copy'
}

/** Plans an install. Throws when a targeted vendor's derived manifest is missing — installing a
 *  plugin whose manifests were never built hands the runtime a half-built plugin, and the author
 *  finds out as a load failure rather than as an error here. */
export function planInstall(input: PlanInput): InstallPlan {
	const missing = input.targets.filter((t) => t.dir !== null && input.manifests[t.vendor] === false)
	if (missing.length > 0) {
		const paths = missing.map((t) => `  - ${t.manifestPath} (${t.vendor})`).join('\n')
		throw new Error(`No derived manifest for:\n${paths}\nRun universal-plugin plugin build first.`)
	}

	const rows: InstallRow[] = []
	const writes: Write[] = []

	for (const target of input.targets) {
		if (target.dir === null) {
			rows.push({
				vendor: target.vendor,
				path: '-',
				action: 'unsupported',
				reason: `${target.vendor} has no local plugin directory; install it from a repository-local marketplace instead`,
			})
			continue
		}

		const dest = destinationPath(target.dir, input.pluginName)
		const state = input.dest[target.vendor] ?? { kind: 'absent' as const }
		const mode = resolveMode(input.mode, target)
		if (mode === null) {
			rows.push({
				vendor: target.vendor,
				path: dest,
				action: 'blocked',
				reason: `${target.vendor} does not load a symlink from outside ${target.dir}; use --copy`,
			})
			continue
		}

		const ours = isOurs(state, input.root, input.pluginName)
		if (state.kind !== 'absent' && !ours && !input.force) {
			rows.push({ vendor: target.vendor, path: dest, action: 'blocked', reason: occupiedReason(state) })
			continue
		}

		if (ours && mode === 'link' && state.kind === 'symlink') {
			rows.push({ vendor: target.vendor, path: dest, action: 'unchanged' })
			continue
		}

		writes.push({ vendor: target.vendor, dest, mode, replace: state.kind !== 'absent' })
		rows.push({ vendor: target.vendor, path: dest, action: mode === 'link' ? 'linked' : 'copied' })
	}

	return { rows, writes, summary: summarizeInstall(rows) }
}

/** Plans an uninstall. Never throws: a destination that was never installed is reported, not an
 *  error, so `uninstall` is safe to run twice and safe to run over a partial install. */
export function planUninstall(input: PlanInput): UninstallPlan {
	const rows: UninstallRow[] = []
	const removals: string[] = []

	for (const target of input.targets) {
		if (target.dir === null) {
			rows.push({ vendor: target.vendor, path: '-', action: 'unsupported' })
			continue
		}

		const dest = destinationPath(target.dir, input.pluginName)
		const state = input.dest[target.vendor] ?? { kind: 'absent' as const }
		if (state.kind === 'absent') {
			rows.push({ vendor: target.vendor, path: dest, action: 'missing' })
			continue
		}

		if (!isOurs(state, input.root, input.pluginName) && !input.force) {
			rows.push({
				vendor: target.vendor,
				path: dest,
				action: 'blocked',
				reason: 'this is not an install of this plugin; --force removes it anyway',
			})
			continue
		}

		removals.push(dest)
		rows.push({ vendor: target.vendor, path: dest, action: 'removed' })
	}

	return { rows, removals, summary: summarizeUninstall(rows) }
}

function summarizeInstall(rows: InstallRow[]): InstallPlan['summary'] {
	const count = (action: InstallAction) => rows.filter((r) => r.action === action).length
	return {
		installed: count('linked') + count('copied'),
		unchanged: count('unchanged'),
		blocked: count('blocked'),
		unsupported: count('unsupported'),
	}
}

function summarizeUninstall(rows: UninstallRow[]): UninstallPlan['summary'] {
	const count = (action: UninstallAction) => rows.filter((r) => r.action === action).length
	return {
		removed: count('removed'),
		missing: count('missing'),
		blocked: count('blocked'),
		unsupported: count('unsupported'),
	}
}
