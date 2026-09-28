import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadRegistry } from './fs.js'
import type { VendorConfig, VendorRegistry } from './vendor-registry.js'
import { lookupVendor, mergeRegistries, withLocalPluginDirs } from './vendor-registry.js'

const claudeCode: VendorConfig = {
	sessionStartEvent: 'SessionStart',
	projectManifest: null,
	hookGlob: '~/.claude/plugins/universal-plugin/hooks/hooks.json',
	pluginRootSuffix: '.claude-plugin/plugin.json',
	localPluginDir: '~/.claude/skills/',
	localPluginLink: true,
	localReload: 'restart Claude Code',
	installCommand: 'claude plugin install {name}',
	removeCommand: 'claude plugin remove {name}',
	updateCommand: 'claude plugin update {name}@{version}',
}

const base: VendorRegistry = { 'claude-code': claudeCode }

it('claudeCode fixture has pluginRootSuffix', () => {
	expect(claudeCode.pluginRootSuffix).toBe('.claude-plugin/plugin.json')
})

describe('lookupVendor', () => {
	it('returns config for known vendor', () => {
		expect(lookupVendor(base, 'claude-code')).toEqual(claudeCode)
	})

	it('returns null for unknown vendor', () => {
		expect(lookupVendor(base, 'unknown')).toBeNull()
	})
})

describe('mergeRegistries', () => {
	it('user override replaces fields in base', () => {
		const override: VendorRegistry = {
			'claude-code': { ...claudeCode, installCommand: 'my-custom-install {name}' },
		}
		const merged = mergeRegistries(base, override)
		expect(merged['claude-code']!.installCommand).toBe('my-custom-install {name}')
	})

	it('user override can add a new vendor', () => {
		const override: VendorRegistry = {
			'my-vendor': { ...claudeCode, sessionStartEvent: 'customStart' },
		}
		const merged = mergeRegistries(base, override)
		expect(merged['my-vendor']).toBeDefined()
		expect(merged['claude-code']).toBeDefined()
	})

	it('base is unchanged when override is empty', () => {
		expect(mergeRegistries(base, {})).toEqual(base)
	})
})

describe('withLocalPluginDirs', () => {
	const { localPluginDir: _, ...withoutDir } = claudeCode

	it('uses the located folder over the registry value', () => {
		const filled = withLocalPluginDirs({ cursor: { ...claudeCode, localPluginDir: '/stale' } }, () => '/located')
		expect(filled['cursor']!.localPluginDir).toBe('/located')
	})

	it('keeps the registry value when nothing is located', () => {
		expect(withLocalPluginDirs({ 'claude-code': claudeCode }, () => undefined)['claude-code']!.localPluginDir).toBe(
			'~/.claude/skills/',
		)
	})

	it('falls back to null when neither has one', () => {
		expect(withLocalPluginDirs({ codex: withoutDir }, () => undefined)['codex']!.localPluginDir).toBeNull()
	})
})

describe('the shipped local-install facts', () => {
	const shipped = JSON.parse(fs.readFileSync(new URL('./data/vendors.json', import.meta.url), 'utf8')) as Record<
		string,
		Partial<VendorConfig>
	>
	const loaded = loadRegistry()

	// Verified against the shipped runtimes in August 2026; see
	// `.research/local-marketplaces/evidence.md`.
	it('Claude Code scans ~/.claude/skills and follows an out-of-tree symlink', () => {
		expect(shipped['claude-code']?.localPluginDir).toBe('~/.claude/skills/')
		expect(shipped['claude-code']?.localPluginLink).toBe(true)
	})

	it('Cursor takes its local plugin folder from @cyberuni/agent-harness and rejects an out-of-tree symlink', () => {
		expect(shipped['cursor']).not.toHaveProperty('localPluginDir')
		expect(loaded['cursor']?.localPluginDir).toBe(path.join(os.homedir(), '.cursor', 'plugins', 'local'))
		expect(shipped['cursor']?.localPluginLink).toBe(false)
	})

	it('Codex and Copilot CLI scan no local plugin directory', () => {
		expect(loaded['codex']?.localPluginDir).toBeNull()
		expect(loaded['copilot-cli']?.localPluginDir).toBeNull()
	})

	it('no per-harness storage path is defined in the registry', () => {
		for (const config of Object.values(shipped)) {
			expect(config).not.toHaveProperty('globalManifest')
			expect(config).not.toHaveProperty('globalPluginDir')
		}
	})

	it('every vendor with a local plugin directory names its reload step', () => {
		for (const config of Object.values(loaded)) {
			if (config.localPluginDir) expect(config.localReload).toBeTruthy()
		}
	})
})
