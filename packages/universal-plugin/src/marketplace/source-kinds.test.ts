import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from 'vitest'

import { addToMarketplace } from './add.js'
import { initializeMarketplace } from './init.js'
import { adaptCatalogContent, adaptSource, deriveSharedCatalog, TARGET_SOURCE_KINDS } from './marketplace.js'
import { validateMarketplace } from './validate.js'

const GITHUB = { source: 'github', repo: 'cyberuni/cyber-sdd' }
const SUBDIR = {
	source: 'git-subdir',
	url: 'https://github.com/cyberuni/cyber-sdd.git',
	path: 'plugins/aced',
	ref: 'v1',
	sha: 'a'.repeat(40),
}
const NPM = { source: 'npm', package: 'repobuddy' }

function fixture(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-source-kinds-'))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
	return root
}

function catalog(root: string, relative: string): { plugins: Record<string, unknown>[] } {
	return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
}

test('the kinds each runtime installs', () => {
	expect(TARGET_SOURCE_KINDS).toEqual({
		claude: ['path', 'npm', 'github', 'url', 'git-subdir'],
		codex: ['path', 'npm', 'url', 'git-subdir'],
		copilot: ['path', 'github', 'url'],
		cursor: ['path', 'github', 'url', 'git-subdir'],
	})
})

test('github becomes a url for Codex, keeping the pins', () => {
	expect(adaptSource('codex', { ...GITHUB, ref: 'v1', sha: 'b'.repeat(40) })).toEqual({
		source: { source: 'url', url: 'https://github.com/cyberuni/cyber-sdd.git', ref: 'v1', sha: 'b'.repeat(40) },
	})
})

test('github with a path becomes git-subdir for Codex and Cursor', () => {
	const source = { ...GITHUB, path: 'plugins/aced', ref: 'v1' }
	const expected = {
		source: { source: 'git-subdir', url: 'https://github.com/cyberuni/cyber-sdd.git', path: 'plugins/aced', ref: 'v1' },
	}
	expect(adaptSource('codex', source)).toEqual(expected)
	expect(adaptSource('cursor', source)).toEqual(expected)
	expect(adaptSource('copilot', source)).toEqual({ source })
})

test('git-subdir on a GitHub URL becomes github + path for Copilot, keeping the pins', () => {
	expect(adaptSource('copilot', SUBDIR)).toEqual({
		source: { source: 'github', repo: 'cyberuni/cyber-sdd', path: 'plugins/aced', ref: 'v1', sha: 'a'.repeat(40) },
	})
	expect(adaptSource('codex', SUBDIR)).toEqual({ source: SUBDIR })
	expect(adaptSource('cursor', SUBDIR)).toEqual({ source: SUBDIR })
})

test('what cannot be mapped is omitted with the runtime named', () => {
	for (const target of ['copilot', 'cursor'] as const) {
		expect(adaptSource(target, NPM)).toEqual({ omitted: `npm source is not supported by ${target}` })
	}
	expect(adaptSource('copilot', { source: 'git-subdir', url: 'https://gitlab.com/o/r.git', path: 'p' })).toHaveProperty(
		'omitted',
	)
	expect(adaptSource('cursor', { source: 'url', url: 'https://example.com/o/r' })).toHaveProperty('omitted')
	expect(adaptSource('cursor', { source: 'url', url: 'https://github.com/o/r' })).toEqual({
		source: { source: 'url', url: 'https://github.com/o/r.git' },
	})
	expect(adaptSource('claude', NPM)).toEqual({ source: NPM })
})

test('a path source passes through every runtime', () => {
	for (const target of ['claude', 'codex', 'copilot', 'cursor'] as const) {
		expect(adaptSource(target, './plugins/a')).toEqual({ source: './plugins/a' })
	}
})

test('adapting a catalog rewrites mapped entries and removes the rest', () => {
	const content = JSON.stringify({
		name: 'm',
		plugins: [
			{ name: 'a', source: './a' },
			{ name: 'b', source: NPM },
			{ name: 'c', source: SUBDIR },
		],
	})
	const { content: out, omitted } = adaptCatalogContent('copilot', content)
	expect(omitted.map((entry) => entry.name)).toEqual(['b'])
	expect((JSON.parse(out) as { plugins: { name: string }[] }).plugins.map((entry) => entry.name)).toEqual(['a', 'c'])
	expect(adaptCatalogContent('claude', content)).toEqual({ content, omitted: [] })
})

test('add maps a github source to a url for Codex and writes it as is for Claude and Copilot', () => {
	const root = fixture()
	try {
		addToMarketplace(root, 'cyberuni/cyber-sdd', { ref: 'v1' })
		expect(catalog(root, '.claude-plugin/marketplace.json').plugins[0]?.source).toMatchObject({ source: 'github' })
		expect(catalog(root, '.github/plugin/marketplace.json').plugins[0]?.source).toMatchObject({ source: 'github' })
		expect(catalog(root, '.agents/plugins/marketplace.json').plugins[0]?.source).toEqual({
			source: 'url',
			url: 'https://github.com/cyberuni/cyber-sdd.git',
			ref: 'v1',
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('shielding: add of an npm entry writes the Copilot and Cursor catalogs from the Claude one, minus the entry', () => {
	const root = fixture()
	try {
		addToMarketplace(root, 'cyberuni/cyber-sdd', { targets: ['claude'] })
		const result = addToMarketplace(root, 'npm:repobuddy')
		expect(result.find((row) => row.target === 'copilot')?.status).toBe('skipped')
		// The github entry already in the Claude catalog still reaches Copilot CLI.
		for (const file of ['.github/plugin/marketplace.json', '.cursor-plugin/marketplace.json']) {
			expect(catalog(root, file).plugins.map((entry) => entry.name)).toEqual(['cyber-sdd'])
		}
		expect(catalog(root, '.claude-plugin/marketplace.json').plugins.map((entry) => entry.name)).toEqual([
			'cyber-sdd',
			'repobuddy',
		])
		expect(validateMarketplace(root).map((row) => row.status)).toEqual(['valid', 'valid', 'valid', 'valid'])
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('shielding: an existing Copilot catalog is left alone when it skips an entry', () => {
	const root = fixture()
	try {
		addToMarketplace(root, './vendor/a', { targets: ['claude', 'copilot'] })
		const before = fs.readFileSync(path.join(root, '.github/plugin/marketplace.json'), 'utf8')
		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude', 'copilot'] })
		expect(fs.readFileSync(path.join(root, '.github/plugin/marketplace.json'), 'utf8')).toBe(before)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('init regenerates without the entries a runtime rejects, and reports them', () => {
	const root = fixture()
	try {
		fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
		addToMarketplace(root, 'cyberuni/cyber-sdd', { targets: ['claude'] })

		const results = initializeMarketplace(root, { force: true })

		const names = (target: string) => results.find((row) => row.target === target)?.plugins
		expect(names('claude')).toEqual(['alpha', 'repobuddy', 'cyber-sdd'])
		expect(names('copilot')).toEqual(['alpha', 'cyber-sdd'])
		expect(names('cursor')).toEqual(['alpha', 'cyber-sdd'])
		expect(results.find((row) => row.target === 'copilot')?.omitted?.map((entry) => entry.name)).toEqual(['repobuddy'])
		expect(
			catalog(root, '.agents/plugins/marketplace.json').plugins.find((e) => e.name === 'cyber-sdd')?.source,
		).toMatchObject({ source: 'url' })
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('shielding: init writes the Copilot catalog even when only Claude was asked for', () => {
	const root = fixture()
	try {
		fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })

		const results = initializeMarketplace(root, { targets: ['claude'], force: true })

		expect(results.map((row) => row.target)).toEqual(['claude', 'copilot', 'cursor'])
		expect(catalog(root, '.github/plugin/marketplace.json').plugins.map((entry) => entry.name)).toEqual(['alpha'])
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('init asked for Claude alone writes nothing extra when the Claude catalog has no rejected entry', () => {
	const root = fixture()
	try {
		fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
		const results = initializeMarketplace(root, { targets: ['claude'] })
		expect(results.map((row) => row.target)).toEqual(['claude'])
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('validate flags an entry a runtime rejects in its own catalog', () => {
	const root = fixture()
	try {
		fs.mkdirSync(path.join(root, '.github/plugin'), { recursive: true })
		fs.writeFileSync(
			path.join(root, '.github/plugin/marketplace.json'),
			JSON.stringify({ name: 'm', owner: { name: 'o' }, plugins: [{ name: 'b', source: NPM }] }),
		)
		const [row] = validateMarketplace(root, { targets: ['copilot'] })
		expect(row?.status).toBe('invalid')
		expect(row?.issues[0]).toMatchObject({ path: 'plugins[0].source' })
		expect(row?.issues[0]?.message).toMatch(
			/npm source is not installable by copilot; Copilot CLI refuses the whole catalog/,
		)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('validate flags the Claude catalog for a runtime that reads it for lack of one of its own', () => {
	const root = fixture()
	try {
		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
		const rows = validateMarketplace(root, { targets: ['copilot', 'cursor', 'codex'] })
		expect(rows.map((row) => [row.target, row.status, row.path])).toEqual([
			['copilot', 'invalid', '.claude-plugin/marketplace.json'],
			['cursor', 'invalid', '.claude-plugin/marketplace.json'],
			['codex', 'missing', '.agents/plugins/marketplace.json'],
		])
		expect(rows[0]?.issues[0]?.message).toMatch(/write \.github\/plugin\/marketplace\.json to shield copilot/)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('validate flags a github entry Codex would silently drop from the Claude catalog', () => {
	const root = fixture()
	try {
		addToMarketplace(root, 'cyberuni/cyber-sdd', { targets: ['claude'] })
		const [row] = validateMarketplace(root, { targets: ['codex'] })
		expect(row?.status).toBe('invalid')
		expect(row?.issues[0]?.message).toMatch(/Codex silently drops the entry/)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('a catalog derived from the Claude one keeps its identity and adapts each entry', () => {
	const claude = JSON.stringify({
		name: 'm',
		owner: { name: 'o' },
		plugins: [
			{ name: 'a', source: SUBDIR },
			{ name: 'b', source: NPM },
		],
	})
	const derived = JSON.parse(deriveSharedCatalog('copilot', claude)) as Record<string, unknown>
	expect(derived).toMatchObject({ name: 'm', owner: { name: 'o' } })
	expect((derived.plugins as { source: { source: string } }[]).map((entry) => entry.source.source)).toEqual(['github'])
})
