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
	expect(parsePluginSpec('plugins/alpha', { kind: 'path' })).toEqual({
		kind: 'path',
		name: 'alpha',
		source: './plugins/alpha',
	})
})

test('an explicit kind overrides every guess', () => {
	expect(parsePluginSpec('cyberuni/universal-plugin', { kind: 'npm' })).toMatchObject({
		source: { source: 'npm', package: 'cyberuni/universal-plugin' },
	})
	expect(parsePluginSpec('npm:repobuddy', { kind: 'npm' })).toMatchObject({
		source: { source: 'npm', package: 'repobuddy' },
	})
	expect(parsePluginSpec('alpha@mkt', { kind: 'github' })).toMatchObject({
		source: { source: 'github', repo: 'alpha@mkt' },
	})
})

test('a spec that names nothing recognizable says which flag to pass', () => {
	expect(() => parsePluginSpec('')).toThrow(/plugin spec is required/)
	expect(() => parsePluginSpec('not a spec')).toThrow(/--path, --npm, --github, --url, or --from-marketplace/)
	expect(() => parsePluginSpec('npm:not a package')).toThrow(/is not an npm package name/)
	expect(() => parsePluginSpec('alpha', { kind: 'marketplace' })).toThrow(/is not <plugin>@<marketplace>/)
})

test('trailing separators do not reach the entry name or the source', () => {
	expect(parsePluginSpec('./plugins/alpha/')).toEqual({ kind: 'path', name: 'alpha', source: './plugins/alpha' })
	expect(parsePluginSpec('plugins/alpha/', { kind: 'path' })).toMatchObject({ source: './plugins/alpha' })
})

test('--subdir narrows a repository source to the directory that is the plugin', () => {
	// Neither github nor url can say which directory of a monorepo is the plugin; git-subdir can.
	expect(parsePluginSpec('cyberuni/cyber-sdd', { subdir: 'plugins/aced' })).toEqual({
		kind: 'github',
		name: 'aced',
		source: { source: 'git-subdir', url: 'https://github.com/cyberuni/cyber-sdd.git', path: 'plugins/aced' },
	})
	expect(parsePluginSpec('https://example.com/o/r.git', { subdir: './pkg/x/' })).toEqual({
		kind: 'url',
		name: 'x',
		source: { source: 'git-subdir', url: 'https://example.com/o/r.git', path: 'pkg/x' },
	})
})

test('--subdir applies only where a repository is being named', () => {
	expect(() => parsePluginSpec('npm:repobuddy', { subdir: 'x' })).toThrow(/applies to a repository source/)
	expect(() => parsePluginSpec('./plugins/alpha', { subdir: 'x' })).toThrow(/applies to a repository source/)
	expect(() => parsePluginSpec('alpha@mkt', { subdir: 'x' })).toThrow(/applies to a repository source/)
	expect(() => parsePluginSpec('cyberuni/r', { subdir: '  ' })).toThrow(/must name a directory/)
	expect(() => parsePluginSpec('cyberuni/r', { subdir: '/abs' })).toThrow(/must be relative/)
})

test('--ref and --sha pin a git source, and only a git source', () => {
	const sha = 'a'.repeat(40)
	expect(parsePluginSpec('cyberuni/r', { ref: 'main' }).source).toEqual({
		source: 'github',
		repo: 'cyberuni/r',
		ref: 'main',
	})
	expect(parsePluginSpec('https://example.com/o/r.git', { sha }).source).toMatchObject({ source: 'url', sha })
	expect(parsePluginSpec('cyberuni/r', { subdir: 'pkg/x', ref: 'v1' }).source).toMatchObject({
		source: 'git-subdir',
		ref: 'v1',
	})

	// An npm package is pinned by version and a path is whatever is on disk.
	expect(() => parsePluginSpec('npm:repobuddy', { ref: 'main' })).toThrow(/apply to a git source/)
	expect(() => parsePluginSpec('./plugins/alpha', { sha })).toThrow(/apply to a git source/)
	// The schema requires a full hash, so a short one is caught here rather than at install time.
	expect(() => parsePluginSpec('cyberuni/r', { sha: 'abc123' })).toThrow(/full 40-character commit hash/)
})
