import * as fsNode from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { type HarnessEnvironment, type HarnessId, pluginStorage } from '@cyberuni/agent-harness'

import { globalStorePath, storeEntryPath } from '../asset-store/asset-store.js'
import { entryExists, populateEntry } from '../asset-store/fs.js'
import type { StateFile } from '../state/state.js'
import { emptyState, mergeSafeState } from '../state/state.js'
import {
	type InstalledPlugin,
	type InstallScope,
	latestVersion,
	parseClaudeInstallRecord,
	toRoots,
	toVersions,
} from './installed-plugins.js'

export interface PrepareFs {
	readManifest(): Record<string, string>
	readPluginRoots(): Record<string, string>
	readGlobalState(): StateFile
	readProjectState(): StateFile | null
	writeGlobalState(state: StateFile): void
	writeProjectState(state: StateFile): void
}

function globalStatePath(): string {
	return path.join(os.homedir(), '.agents', 'universal-plugin.json')
}

function projectStatePath(root: string): string {
	return path.join(root, '.agents', 'universal-plugin.json')
}

function readStateFile(filePath: string): StateFile | null {
	try {
		return mergeSafeState(JSON.parse(fsNode.readFileSync(filePath, 'utf8')) as StateFile)
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
		throw err
	}
}

function writeStateFile(filePath: string, state: StateFile): void {
	fsNode.mkdirSync(path.dirname(filePath), { recursive: true })
	fsNode.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

/** `environment` locates the harness's plugin folders; it defaults to the current process. */
export function realPrepareFs(
	harness: HarnessId,
	installScope: InstallScope,
	environment: HarnessEnvironment = {},
): PrepareFs {
	const projectRoot = installScope.projectRoot
	let installed: InstalledPlugin[] | undefined
	const readInstalled = () => (installed ??= readInstalledPlugins(harness, installScope, environment))
	return {
		readManifest: () => toVersions(readInstalled()),
		readPluginRoots: () => toRoots(readInstalled(), environment.homedir ?? os.homedir()),
		readGlobalState: () => readStateFile(globalStatePath()) ?? emptyState(),
		readProjectState: () => (projectRoot ? readStateFile(projectStatePath(projectRoot)) : null),
		writeGlobalState: (s) => writeStateFile(globalStatePath(), s),
		writeProjectState: (s) => {
			if (projectRoot) writeStateFile(projectStatePath(projectRoot), s)
		},
	}
}

export function populateStoreFromVendorCache(
	pluginRoots: Record<string, string>,
	versions: Record<string, string>,
): void {
	const storePath = globalStorePath()
	for (const [pluginName, pluginRoot] of Object.entries(pluginRoots)) {
		const version = versions[pluginName] ?? 'unknown'
		const segment = `npm/${pluginName}@${version}`
		const entryPath = storeEntryPath(storePath, segment)
		if (entryExists(entryPath)) continue
		populateEntry(entryPath, expandHome(pluginRoot))
	}
}

function expandHome(p: string): string {
	return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p
}

/** Lists what a harness has installed, the way that harness records it: Claude Code in its install
 *  record, Copilot CLI and Codex only in the layout of their plugin folders. Cursor keeps no record
 *  of installed plugins. */
function readInstalledPlugins(
	harness: HarnessId,
	installScope: InstallScope,
	environment: HarnessEnvironment,
): InstalledPlugin[] {
	const storage = pluginStorage(harness, environment)
	const location = (kind: string) => storage.locations.find((l) => l.kind === kind)?.path
	switch (harness) {
		case 'claude-code': {
			const record = location('install-record')
			const raw = record ? readJson(record) : null
			return raw === null ? [] : parseClaudeInstallRecord(raw, installScope)
		}
		case 'copilot-cli': {
			// Copilot CLI installs are user-level only.
			const dir = location('installed-plugins')
			return dir && installScope.scope === 'global' ? readCopilotInstalls(dir) : []
		}
		case 'codex': {
			const dir = location('plugin-cache')
			return dir && installScope.scope === 'global' ? readCodexCache(dir) : []
		}
		default:
			return []
	}
}

/** `<dir>/<marketplace>/<plugin>/` for marketplace installs, `<dir>/_direct/<source-id>/` for
 *  direct ones; the plugin's own manifest carries its name and version. */
function readCopilotInstalls(dir: string): InstalledPlugin[] {
	return subdirs(dir).flatMap((marketplace) =>
		subdirs(path.join(dir, marketplace)).map((folder) => {
			const root = path.join(dir, marketplace, folder)
			const manifest = readPluginManifest(root)
			return {
				name: typeof manifest['name'] === 'string' ? manifest['name'] : folder,
				version: typeof manifest['version'] === 'string' ? manifest['version'] : 'unknown',
				root,
			}
		}),
	)
}

/** `<dir>/<marketplace>/<plugin>/<version>/`; the newest cached version is the installed one. */
function readCodexCache(dir: string): InstalledPlugin[] {
	return subdirs(dir).flatMap((marketplace) =>
		subdirs(path.join(dir, marketplace)).flatMap((name) => {
			const version = latestVersion(subdirs(path.join(dir, marketplace, name)))
			return version ? [{ name, version, root: path.join(dir, marketplace, name, version) }] : []
		}),
	)
}

const PLUGIN_MANIFESTS = ['plugin.json', '.github/plugin/plugin.json', '.claude-plugin/plugin.json']

function readPluginManifest(root: string): Record<string, unknown> {
	for (const file of PLUGIN_MANIFESTS) {
		const raw = readJson(path.join(root, file))
		if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
	}
	return {}
}

function readJson(filePath: string): unknown {
	try {
		return JSON.parse(fsNode.readFileSync(filePath, 'utf8'))
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
		throw err
	}
}

function subdirs(dir: string): string[] {
	try {
		return fsNode
			.readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
		throw err
	}
}
