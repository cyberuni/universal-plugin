import { expect, test } from 'vitest'

import { parsePluginSpec } from './spec.js'

test('reads each source form and the entry name it implies', () => {
	expect(parsePluginSpec('./plugins/alpha')).toEqual({ kind: 'path', name: 'alpha', source: './plugins/alpha' })
	expect(parsePluginSpec('npm:repobuddy')).toEqual({
		kind: 'npm',
		name: 'repobuddy',
		source: { source: 'npm', package: 'repobuddy' },
	})
	expect(parsePluginSpec('cyberuni/universal-plugin')).toEqual({
		kind: 'github',
		name: 'universal-plugin',
		source: { source: 'github', repo: 'cyberuni/universal-plugin' },
	})
	expect(parsePluginSpec('https://example.com/org/repo.git')).toEqual({
		kind: 'url',
		name: 'repo',
		source: { source: 'url', url: 'https://example.com/org/repo.git' },
	})
	expect(parsePluginSpec('git@github.com:cyberuni/universal-plugin.git')).toMatchObject({ kind: 'url' })
	expect(parsePluginSpec('repobuddy')).toMatchObject({ kind: 'npm' })
})

test('a leading scope marker is part of a package name, not a marketplace separator', () => {
	// `@cyberuni/upx` and `upx@cyberplace` both carry an `@`; only the second one names a marketplace.
	expect(parsePluginSpec('@cyberuni/upx')).toEqual({
		kind: 'npm',
		name: 'upx',
		source: { source: 'npm', package: '@cyberuni/upx' },
	})
	expect(parsePluginSpec('repobuddy@cyberplace')).toEqual({
		kind: 'marketplace',
		name: 'repobuddy',
		plugin: 'repobuddy',
		marketplace: 'cyberplace',
	})
	expect(parsePluginSpec('@scope/pkg@cyberplace')).toEqual({
		kind: 'marketplace',
		name: 'pkg',
		plugin: '@scope/pkg',
		marketplace: 'cyberplace',
	})
})

test('a path says so, because owner/repo and a directory are the same string', () => {
	// Guessing from the filesystem would answer differently depending on where the command was run.
	expect(parsePluginSpec('plugins/alpha')).toMatchObject({ kind: 'github' })
	expect(parsePluginSpec('plugins/alpha', 'path')).toEqual({
		kind: 'path',
		name: 'alpha',
		source: './plugins/alpha',
	})
})

test('an explicit kind overrides every guess', () => {
	expect(parsePluginSpec('cyberuni/universal-plugin', 'npm')).toMatchObject({
		source: { source: 'npm', package: 'cyberuni/universal-plugin' },
	})
	expect(parsePluginSpec('npm:repobuddy', 'npm')).toMatchObject({ source: { source: 'npm', package: 'repobuddy' } })
	expect(parsePluginSpec('alpha@mkt', 'github')).toMatchObject({ source: { source: 'github', repo: 'alpha@mkt' } })
})

test('a spec that names nothing recognizable says which flag to pass', () => {
	expect(() => parsePluginSpec('')).toThrow(/plugin spec is required/)
	expect(() => parsePluginSpec('not a spec')).toThrow(/--path, --npm, --github, --url, or --from-marketplace/)
	expect(() => parsePluginSpec('npm:not a package')).toThrow(/is not an npm package name/)
	expect(() => parsePluginSpec('alpha', 'marketplace')).toThrow(/is not <plugin>@<marketplace>/)
})

test('trailing separators do not reach the entry name or the source', () => {
	expect(parsePluginSpec('./plugins/alpha/')).toEqual({ kind: 'path', name: 'alpha', source: './plugins/alpha' })
	expect(parsePluginSpec('plugins/alpha/', 'path')).toMatchObject({ source: './plugins/alpha' })
})
