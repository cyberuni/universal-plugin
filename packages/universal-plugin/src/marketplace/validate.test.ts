import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { initializeMarketplace } from './init.js'
import { validateMarketplace } from './validate.js'

let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-marketplace-validate-'))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
	fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
	fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

function claudeCatalog(): string {
	return path.join(root, '.claude-plugin/marketplace.json')
}

test('every generated catalog validates', () => {
	initializeMarketplace(root)
	expect(validateMarketplace(root).map((row) => [row.target, row.status])).toEqual([
		['claude', 'valid'],
		['codex', 'valid'],
		['copilot', 'valid'],
		['cursor', 'valid'],
	])
})

test('a catalog that is absent is missing, or invalid when the target is required', () => {
	expect(validateMarketplace(root, { targets: ['claude'] })[0]).toMatchObject({ status: 'missing', issues: [] })
	expect(validateMarketplace(root, { targets: ['claude'], required: true })[0]).toMatchObject({ status: 'invalid' })
})

test('a hand-edited catalog is reported with the key at fault', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	const catalog = JSON.parse(fs.readFileSync(claudeCatalog(), 'utf8'))
	catalog.owner = 'Ari Vance'
	fs.writeFileSync(claudeCatalog(), JSON.stringify(catalog, null, 2))

	const row = validateMarketplace(root, { targets: ['claude'] })[0]
	expect(row?.status).toBe('invalid')
	expect(row?.issues[0]?.path).toBe('owner')
})

// A source that resolves nowhere passes every schema check and still installs nothing.
test('a source pointing at a directory that does not exist is an issue', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	fs.rmSync(path.join(root, 'plugins', 'alpha'), { recursive: true })

	expect(validateMarketplace(root, { targets: ['claude'] })[0]?.issues).toEqual([
		{ path: 'plugins[0].source', message: 'points at "./plugins/alpha", which does not exist' },
	])
})

function editCatalog(edit: (catalog: Record<string, unknown> & { plugins: Record<string, unknown>[] }) => void): void {
	const catalog = JSON.parse(fs.readFileSync(claudeCatalog(), 'utf8'))
	edit(catalog)
	fs.writeFileSync(claudeCatalog(), JSON.stringify(catalog, null, 2))
}

function claudeIssues() {
	return validateMarketplace(root, { targets: ['claude'] })[0]?.issues ?? []
}

// Claude Code resolves a plain dependency only through the catalog its dependent was installed from,
// so a listed plugin whose plain dependency is not listed beside it cannot install from there.
test('a plain catalog entry dependency the catalog does not list is an issue', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	editCatalog((catalog) => {
		catalog.plugins[0] = { ...catalog.plugins[0], dependencies: ['beta', { name: 'gamma' }] }
	})

	const issues = claudeIssues()
	expect(issues.map((issue) => issue.path)).toEqual(['plugins[0].dependencies', 'plugins[0].dependencies'])
	expect(issues[0]?.message).toMatch(/dependency "beta" is not listed in ".claude-plugin\/marketplace.json"/)
	expect(issues[1]?.message).toMatch(/dependency "gamma" is not listed/)

	editCatalog((catalog) => {
		catalog.plugins.push({ name: 'beta', source: { source: 'npm', package: 'beta' } })
		catalog.plugins.push({ name: 'gamma', source: { source: 'npm', package: 'gamma' } })
	})
	expect(claudeIssues()).toEqual([])
})

// A dependency that names its marketplace is the author's claim about where it resolves; only a
// plain one is held to this catalog's listing.
test('a dependency qualified with this catalog name is not held to its listing', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	editCatalog((catalog) => {
		catalog.name = 'cyberplace'
		catalog.plugins[0] = {
			...catalog.plugins[0],
			dependencies: ['beta@cyberplace', { name: 'gamma', marketplace: 'cyberplace' }],
		}
	})
	expect(claudeIssues()).toEqual([])
})

test('a cross-marketplace dependency needs the catalog allowCrossMarketplaceDependenciesOn', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	editCatalog((catalog) => {
		catalog.plugins[0] = { ...catalog.plugins[0], dependencies: ['beta@other'] }
	})
	expect(claudeIssues()).toEqual([
		{
			path: 'plugins[0].dependencies',
			message: expect.stringMatching(/"beta@other" names marketplace "other".*allowCrossMarketplaceDependenciesOn/),
		},
	])

	editCatalog((catalog) => {
		catalog.allowCrossMarketplaceDependenciesOn = ['other']
	})
	expect(claudeIssues()).toEqual([])
})

// The plugin at a "./" source is on disk, so the dependencies Claude Code will read are checkable
// offline: the built `.claude-plugin/plugin.json`, or the canonical declaration before a build.
test('a local plugin manifest dependencies are checked against the catalog', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	const alpha = path.join(root, 'plugins', 'alpha')
	fs.writeFileSync(
		path.join(alpha, 'plugin.json'),
		JSON.stringify({
			name: 'alpha',
			extensions: { 'org.cyberuni.universal-plugin': { dependencies: ['beta'] } },
		}),
	)
	expect(claudeIssues()).toEqual([
		{ path: 'plugins[0].source', message: expect.stringMatching(/dependency "beta" is not listed/) },
	])

	fs.writeFileSync(
		path.join(alpha, 'plugin.json'),
		JSON.stringify({
			name: 'alpha',
			extensions: {
				'org.cyberuni.universal-plugin': {
					dependencies: ['beta'],
					harnesses: { 'claude-code': { dependencies: ['delta'] } },
				},
			},
		}),
	)
	expect(claudeIssues()).toEqual([
		{ path: 'plugins[0].source', message: expect.stringMatching(/dependency "delta" is not listed/) },
	])

	fs.mkdirSync(path.join(alpha, '.claude-plugin'))
	fs.writeFileSync(path.join(alpha, '.claude-plugin', 'plugin.json'), JSON.stringify({ dependencies: ['gamma'] }))
	expect(claudeIssues()).toEqual([
		{ path: 'plugins[0].source', message: expect.stringMatching(/dependency "gamma" is not listed/) },
	])
})

test('a dependency declared in both the entry and the manifest is reported once', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	fs.mkdirSync(path.join(root, 'plugins', 'alpha', '.claude-plugin'))
	fs.writeFileSync(
		path.join(root, 'plugins', 'alpha', '.claude-plugin', 'plugin.json'),
		JSON.stringify({ dependencies: ['beta'] }),
	)
	editCatalog((catalog) => {
		catalog.plugins[0] = { ...catalog.plugins[0], dependencies: ['beta'] }
	})
	expect(claudeIssues()).toHaveLength(1)
})

test('a manifest that cannot be read declares nothing to check', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), '[')
	expect(claudeIssues()).toEqual([])
	fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), '[]')
	expect(claudeIssues()).toEqual([])
})

// Only Claude Code reads plugin dependencies; the other catalogs resolve none.
test('dependencies are checked only in the Claude catalog', () => {
	initializeMarketplace(root, { targets: ['cursor'] })
	const file = path.join(root, '.cursor-plugin/marketplace.json')
	const catalog = JSON.parse(fs.readFileSync(file, 'utf8'))
	catalog.plugins[0].dependencies = ['beta']
	fs.writeFileSync(file, JSON.stringify(catalog))
	expect(validateMarketplace(root, { targets: ['cursor'] })[0]?.issues).toEqual([])
})

test('a catalog whose plugins are not an array has no dependency to check', () => {
	initializeMarketplace(root, { targets: ['claude'] })
	editCatalog((catalog) => {
		;(catalog as Record<string, unknown>).plugins = 'none'
	})
	expect(claudeIssues()).toEqual([{ path: 'plugins', message: 'must be an array, not string' }])
	editCatalog((catalog) => {
		catalog.plugins = ['x' as unknown as Record<string, unknown>]
	})
	expect(claudeIssues()).toEqual([{ path: 'plugins[0]', message: 'must be an object, not string' }])
})
