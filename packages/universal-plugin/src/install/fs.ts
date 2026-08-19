import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import type { DestState, Write } from './install.js'

function expandHome(p: string): string {
	return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
}

/** Resolves a vendor's local plugin directory to an absolute path. */
export function resolveLocalDir(localPluginDir: string | null): string | null {
	return localPluginDir === null ? null : path.resolve(expandHome(localPluginDir))
}

/** Reads what occupies a destination. A symlink is reported with its resolved target so the plan
 *  can tell our own install from someone else's; a directory is reported with the `name` of the
 *  canonical manifest inside it, which is what identifies an earlier `--copy` install. */
export function readDestination(dest: string): DestState {
	let stats: fs.Stats
	try {
		stats = fs.lstatSync(dest)
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'absent' }
		throw err
	}

	if (stats.isSymbolicLink()) {
		try {
			return { kind: 'symlink', target: fs.realpathSync(dest) }
		} catch {
			// A dangling symlink points at nothing we can compare, so it is never ours.
			return { kind: 'symlink', target: fs.readlinkSync(dest) }
		}
	}
	if (!stats.isDirectory()) return { kind: 'file' }
	return { kind: 'directory', pluginName: readPluginName(path.join(dest, 'plugin.json')) }
}

function readPluginName(manifestPath: string): string | null {
	try {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: unknown }
		return typeof manifest.name === 'string' ? manifest.name : null
	} catch {
		return null
	}
}

/** Entries a copy never carries: the working copy's history and its installed dependencies. Neither
 *  is part of the plugin, and both dwarf it. */
const COPY_EXCLUDED = new Set(['.git', 'node_modules'])

/** Applies one planned write. A replace removes the destination first, so a copy never merges into
 *  what was there before. A copy dereferences symlinks — a skill linked into the tree has to travel
 *  as its content, since the destination is read on its own. */
export function applyWrite(root: string, write: Write): void {
	if (write.replace) fs.rmSync(write.dest, { recursive: true, force: true })
	fs.mkdirSync(path.dirname(write.dest), { recursive: true })
	if (write.mode === 'link') {
		fs.symlinkSync(root, write.dest, 'dir')
		return
	}
	fs.cpSync(root, write.dest, {
		recursive: true,
		dereference: true,
		filter: (source) => !COPY_EXCLUDED.has(path.basename(source)),
	})
}

export function applyRemoval(dest: string): void {
	fs.rmSync(dest, { recursive: true, force: true })
}
