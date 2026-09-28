import { describe, expect, it } from 'vitest'
import { latestVersion, parseClaudeInstallRecord, pluginName, toRoots, toVersions } from './installed-plugins.js'

const record = {
	version: 2,
	plugins: {
		'cyber-github@cyberplace': [
			{ scope: 'user', installPath: '/h/.claude/plugins/cache/cyberplace/cyber-github/1.2.0', version: '1.2.0' },
		],
		'aced@cyberplace': [
			{
				scope: 'project',
				projectPath: '/work/repo',
				installPath: '/h/.claude/plugins/cache/cyberplace/aced/0.3.0',
				version: '0.3.0',
			},
		],
	},
}

describe('parseClaudeInstallRecord', () => {
	it('reads user installs for global scope, keyed by plugin name', () => {
		expect(parseClaudeInstallRecord(record, { scope: 'global' })).toEqual([
			{ name: 'cyber-github', version: '1.2.0', root: '/h/.claude/plugins/cache/cyberplace/cyber-github/1.2.0' },
		])
	})

	it('reads the installs of the given project for project scope', () => {
		expect(parseClaudeInstallRecord(record, { scope: 'project', projectRoot: '/work/repo' })).toEqual([
			{ name: 'aced', version: '0.3.0', root: '/h/.claude/plugins/cache/cyberplace/aced/0.3.0' },
		])
		expect(parseClaudeInstallRecord(record, { scope: 'project', projectRoot: '/other' })).toEqual([])
	})

	it('ignores a record without a plugins map', () => {
		expect(parseClaudeInstallRecord({ 'cyber-github': { version: '1.0.0' } }, { scope: 'global' })).toEqual([])
		expect(parseClaudeInstallRecord(null, { scope: 'global' })).toEqual([])
	})

	it('skips entries without an install path and defaults a missing version', () => {
		const raw = { plugins: { 'a@m': [{ scope: 'user' }], 'b@m': [{ scope: 'user', installPath: '/b' }] } }
		expect(parseClaudeInstallRecord(raw, { scope: 'global' })).toEqual([{ name: 'b', version: 'unknown', root: '/b' }])
	})
})

describe('pluginName', () => {
	it('strips the marketplace suffix', () => {
		expect(pluginName('cyber-github@cyberplace')).toBe('cyber-github')
		expect(pluginName('@scope/plugin@mkt')).toBe('@scope/plugin')
		expect(pluginName('bare')).toBe('bare')
	})
})

describe('latestVersion', () => {
	it('compares dotted versions numerically', () => {
		expect(latestVersion(['1.9.0', '1.10.0', '1.2.3'])).toBe('1.10.0')
	})

	it('returns undefined when there are none', () => {
		expect(latestVersion([])).toBeUndefined()
	})
})

describe('toVersions / toRoots', () => {
	const plugins = [{ name: 'a', version: '1.0.0', root: '/h/.codex/plugins/cache/m/a/1.0.0' }]

	it('maps names to versions', () => {
		expect(toVersions(plugins)).toEqual({ a: '1.0.0' })
	})

	it('maps names to roots with home written as ~', () => {
		expect(toRoots(plugins, '/h')).toEqual({ a: '~/.codex/plugins/cache/m/a/1.0.0' })
		expect(toRoots(plugins, '/elsewhere')).toEqual({ a: '/h/.codex/plugins/cache/m/a/1.0.0' })
	})
})
