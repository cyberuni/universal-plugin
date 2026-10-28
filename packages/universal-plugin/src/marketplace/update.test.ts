import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { addToMarketplace } from './add.js'
import { updateMarketplaceEntry } from './update.js'

const SHA = 'a'.repeat(40)
const CLAUDE = '.claude-plugin/marketplace.json'
let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-update-'))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

function read(relative: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as Record<string, unknown>
}

function entry(relative: string, name: string): Record<string, unknown> | undefined {
	return (read(relative).plugins as Record<string, unknown>[]).find((item) => item.name === name)
}

/** A curator's edit `add` cannot derive and `add --force` would drop. */
function curate(relative: string, name: string, fields: Record<string, unknown>): void {
	const catalog = read(relative)
	catalog.plugins = (catalog.plugins as Record<string, unknown>[]).map((item) =>
		item.name === name ? { ...item, ...fields } : item,
	)
	fs.writeFileSync(path.join(root, relative), `${JSON.stringify(catalog, null, 2)}\n`)
}

test('switches a github entry to a url source and keeps the pin and every curated field', () => {
	addToMarketplace(root, 'cyberuni/repobuddy', {
		ref: 'v1.0.0',
		sha: SHA,
		metadata: { description: 'Repo automation' },
	})
	curate(CLAUDE, 'repobuddy', { category: 'productivity', author: { name: 'unional' } })

	const results = updateMarketplaceEntry(root, 'repobuddy', { source: 'https://github.com/cyberuni/repobuddy.git' })

	expect(results.map((row) => [row.target, row.status])).toEqual([
		['claude', 'updated'],
		// Codex already states a github repository as this url, so nothing changes there.
		['codex', 'unchanged'],
		['copilot', 'updated'],
		['cursor', 'updated'],
	])
	expect(entry(CLAUDE, 'repobuddy')).toEqual({
		name: 'repobuddy',
		source: { source: 'url', url: 'https://github.com/cyberuni/repobuddy.git', ref: 'v1.0.0', sha: SHA },
		description: 'Repo automation',
		category: 'productivity',
		author: { name: 'unional' },
	})
	expect(entry('.github/plugin/marketplace.json', 'repobuddy')?.source).toEqual({
		source: 'url',
		url: 'https://github.com/cyberuni/repobuddy.git',
		ref: 'v1.0.0',
		sha: SHA,
	})
})

test('a pin named with the new source replaces the old one', () => {
	addToMarketplace(root, 'cyberuni/repobuddy', { targets: ['claude'], ref: 'v1.0.0' })
	updateMarketplaceEntry(root, 'repobuddy', { targets: ['claude'], source: 'cyberuni/repobuddy', ref: 'v2.0.0' })
	expect(entry(CLAUDE, 'repobuddy')?.source).toEqual({ source: 'github', repo: 'cyberuni/repobuddy', ref: 'v2.0.0' })
})

test('bumps a ref and drops the sha that pinned the old one', () => {
	addToMarketplace(root, 'cyberuni/cyber-sdd', { subdir: 'plugins/aced', ref: 'v1.0.0', sha: SHA })

	updateMarketplaceEntry(root, 'aced', { ref: 'v1.1.0', unset: ['sha'] })

	const expected = { url: 'https://github.com/cyberuni/cyber-sdd.git', path: 'plugins/aced', ref: 'v1.1.0' }
	expect(entry(CLAUDE, 'aced')?.source).toEqual({ source: 'git-subdir', ...expected })
	expect(entry('.agents/plugins/marketplace.json', 'aced')?.source).toEqual({ source: 'git-subdir', ...expected })
	expect(entry('.github/plugin/marketplace.json', 'aced')?.source).toEqual({
		source: 'github',
		repo: 'cyberuni/cyber-sdd',
		path: 'plugins/aced',
		ref: 'v1.1.0',
	})
})

test('changes one field and leaves the rest of the catalog as it was', () => {
	addToMarketplace(root, 'npm:alpha', { targets: ['claude'], metadata: { description: 'Alpha' } })
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'], metadata: { description: 'Old', license: 'MIT' } })
	curate(CLAUDE, 'repobuddy', { category: 'productivity' })
	const before = read(CLAUDE)

	const results = updateMarketplaceEntry(root, 'repobuddy', { metadata: { description: 'New' } })

	expect(results.find((row) => row.target === 'claude')?.status).toBe('updated')
	const after = read(CLAUDE)
	expect(Object.keys(after)).toEqual(Object.keys(before))
	expect(entry(CLAUDE, 'alpha')).toEqual((before.plugins as unknown[])[0])
	expect(Object.keys(entry(CLAUDE, 'repobuddy') ?? {})).toEqual([
		'name',
		'source',
		'description',
		'license',
		'category',
	])
	expect(entry(CLAUDE, 'repobuddy')).toMatchObject({ description: 'New', license: 'MIT', category: 'productivity' })
})

test('sets a category and unsets a field', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'], metadata: { license: 'MIT' } })
	updateMarketplaceEntry(root, 'repobuddy', { metadata: { category: 'productivity' }, unset: ['license'] })
	expect(entry(CLAUDE, 'repobuddy')).toEqual({
		name: 'repobuddy',
		source: { source: 'npm', package: 'repobuddy' },
		category: 'productivity',
	})
})

test('a catalog that does not list the entry is skipped, and one that already agrees is unchanged', () => {
	addToMarketplace(root, 'npm:repobuddy', { metadata: { description: 'Same' } })

	const results = updateMarketplaceEntry(root, 'repobuddy', { metadata: { description: 'Same' } })

	expect(results.map((row) => [row.target, row.status])).toEqual([
		['claude', 'unchanged'],
		['codex', 'unchanged'],
		['copilot', 'skipped'],
		['cursor', 'skipped'],
	])
	expect(results[2]?.reason).toMatch(/"repobuddy" is not listed in \.github\/plugin\/marketplace\.json/)
})

test('a source a runtime cannot install leaves that entry alone and says why', () => {
	addToMarketplace(root, 'cyberuni/repobuddy')

	const results = updateMarketplaceEntry(root, 'repobuddy', { source: 'npm:repobuddy' })

	expect(results.map((row) => [row.target, row.status])).toEqual([
		['claude', 'updated'],
		['codex', 'updated'],
		['copilot', 'skipped'],
		['cursor', 'skipped'],
	])
	expect(results[2]?.reason).toMatch(/npm source is not supported by copilot; "repobuddy" keeps its current source/)
	expect(entry('.github/plugin/marketplace.json', 'repobuddy')?.source).toEqual({
		source: 'github',
		repo: 'cyberuni/repobuddy',
	})
})

test('a runtime with no catalog of its own is shielded from a source it cannot install', () => {
	addToMarketplace(root, 'cyberuni/repobuddy', { targets: ['claude'] })

	const results = updateMarketplaceEntry(root, 'repobuddy', { source: 'npm:repobuddy' })

	expect(results[2]).toMatchObject({ target: 'copilot', status: 'skipped' })
	expect(results[2]?.reason).toMatch(/now has a source it cannot install; wrote \.github\/plugin\/marketplace\.json/)
	expect(read('.github/plugin/marketplace.json').plugins).toEqual([])
	// Codex installs npm, so it reads the Claude catalog unharmed and gets no file.
	expect(fs.existsSync(path.join(root, '.agents/plugins/marketplace.json'))).toBe(false)
})

test('dry run reports the plan and writes nothing', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	const before = fs.readFileSync(path.join(root, CLAUDE), 'utf8')

	const results = updateMarketplaceEntry(root, 'repobuddy', {
		targets: ['claude'],
		metadata: { description: 'New' },
		dryRun: true,
	})

	expect(results).toEqual([
		{
			target: 'claude',
			status: 'planned',
			entry: 'repobuddy',
			source: 'npm:repobuddy',
			path: CLAUDE,
		},
	])
	expect(fs.readFileSync(path.join(root, CLAUDE), 'utf8')).toBe(before)
})

test('an update that would leave a catalog invalid writes nothing', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	const before = fs.readFileSync(path.join(root, CLAUDE), 'utf8')

	expect(() => updateMarketplaceEntry(root, 'repobuddy', { source: './vendor/missing' })).toThrow(
		/plugins\[0\]\.source points at "\.\/vendor\/missing", which does not exist/,
	)
	expect(fs.readFileSync(path.join(root, CLAUDE), 'utf8')).toBe(before)
})

test('a problem the catalog already had does not block an unrelated change', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	const catalog = read(CLAUDE)
	catalog.plugins = [...(catalog.plugins as unknown[]), { name: 'gone', source: './plugins/gone' }]
	fs.writeFileSync(path.join(root, CLAUDE), JSON.stringify(catalog, null, 2))

	const results = updateMarketplaceEntry(root, 'repobuddy', { targets: ['claude'], metadata: { description: 'New' } })

	expect(results[0]?.status).toBe('updated')
})

test.each([
	[{}, /nothing to change/],
	[{ unset: ['name'] }, /--unset cannot remove "name"/],
	[{ unset: ['source'] }, /--unset cannot remove "source"/],
	[{ metadata: { description: 'x' }, unset: ['description'] }, /"description" is both set and unset/],
	[{ ref: 'main', unset: ['ref'] }, /"ref" is both set and unset/],
	[{ sha: 'abc123' }, /full 40-character commit hash/],
	[{ source: 'repobuddy@cyberplace' }, /not <plugin>@<marketplace>/],
	[{ subdir: 'plugins/aced' }, /pass --source as well/],
])('refuses a request that changes nothing or contradicts itself: %o', (opts, message) => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	expect(() => updateMarketplaceEntry(root, 'repobuddy', opts)).toThrow(message)
})

test('a pin on an entry whose source carries none fails before writes', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	expect(() => updateMarketplaceEntry(root, 'repobuddy', { ref: 'main' })).toThrow(
		/"repobuddy" in \.claude-plugin\/marketplace\.json has a npm source; --ref and --sha apply to a git source/,
	)
})

test('an entry no selected catalog lists points at add', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	expect(() => updateMarketplaceEntry(root, 'ghost', { metadata: { description: 'x' } })).toThrow(
		/"ghost" is not listed in any selected catalog; list it with marketplace add/,
	)
})

test('a Codex entry takes only the fields its catalog carries', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude', 'codex'] })

	updateMarketplaceEntry(root, 'repobuddy', { metadata: { description: 'New', category: 'Developer Tools' } })

	expect(entry(CLAUDE, 'repobuddy')).toMatchObject({ description: 'New', category: 'Developer Tools' })
	const codex = entry('.agents/plugins/marketplace.json', 'repobuddy')
	expect(codex).toMatchObject({ category: 'Developer Tools' })
	expect(codex).not.toHaveProperty('description')
})

test('a pin on an entry that names no source fails with a message, not a crash', () => {
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })
	curate(CLAUDE, 'repobuddy', { source: undefined })
	expect(() => updateMarketplaceEntry(root, 'repobuddy', { targets: ['claude'], ref: 'main' })).toThrow(
		/has a missing source; --ref and --sha apply to a git source/,
	)
})
