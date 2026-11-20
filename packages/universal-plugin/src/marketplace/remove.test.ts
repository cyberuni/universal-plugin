import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { addToMarketplace } from './add.js'
import { removeMarketplaceEntry } from './remove.js'

const CLAUDE = '.claude-plugin/marketplace.json'
const CODEX = '.agents/plugins/marketplace.json'
const COPILOT = '.github/plugin/marketplace.json'
let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-remove-'))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

function read(relative: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as Record<string, unknown>
}

function names(relative: string): unknown[] {
	return (read(relative).plugins as Record<string, unknown>[]).map((item) => item.name)
}

function edit(relative: string, change: (catalog: Record<string, unknown>) => void): void {
	const catalog = read(relative)
	change(catalog)
	fs.writeFileSync(path.join(root, relative), `${JSON.stringify(catalog, null, 2)}\n`)
}

test('drops the entry from every catalog that lists it and keeps everything else', () => {
	addToMarketplace(root, 'npm:alpha')
	addToMarketplace(root, 'cyberuni/repobuddy')
	addToMarketplace(root, 'npm:omega')
	edit(CLAUDE, (catalog) => {
		catalog.description = 'Curated'
		catalog.owner = { name: 'unional', email: 'me@example.com' }
		;(catalog.plugins as Record<string, unknown>[])[0].category = 'tools'
	})
	const before = read(CLAUDE)

	const { results, warnings } = removeMarketplaceEntry(root, 'repobuddy')

	expect(results.map((row) => [row.target, row.status, row.source])).toEqual([
		['claude', 'removed', 'github:cyberuni/repobuddy'],
		['codex', 'removed', 'url:https://github.com/cyberuni/repobuddy.git'],
		['copilot', 'removed', 'github:cyberuni/repobuddy'],
		['cursor', 'removed', 'github:cyberuni/repobuddy'],
	])
	expect(warnings).toEqual([])
	expect(read(CLAUDE)).toEqual({
		...before,
		plugins: (before.plugins as Record<string, unknown>[]).filter((item) => item.name !== 'repobuddy'),
	})
	for (const catalog of [CODEX, COPILOT]) expect(names(catalog)).not.toContain('repobuddy')
})

test('a catalog that does not list the entry is skipped', () => {
	addToMarketplace(root, 'npm:alpha', { targets: ['claude', 'codex'] })
	addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })

	const { results } = removeMarketplaceEntry(root, 'repobuddy', { targets: ['claude', 'codex', 'copilot'] })

	expect(results.map((row) => [row.target, row.status, row.reason])).toEqual([
		['claude', 'removed', undefined],
		['codex', 'skipped', `"repobuddy" is not listed in ${CODEX}`],
		['copilot', 'skipped', `no catalog at ${COPILOT}`],
	])
	expect(names(CLAUDE)).toEqual(['alpha'])
})

test('an entry no selected catalog lists fails', () => {
	addToMarketplace(root, 'npm:alpha', { targets: ['claude'] })
	expect(() => removeMarketplaceEntry(root, 'ghost')).toThrow(/"ghost" is not listed in any selected catalog/)
})

test('refuses to remove an entry another listed plugin depends on, and --force removes it with a warning', () => {
	addToMarketplace(root, 'npm:base', { targets: ['claude'] })
	addToMarketplace(root, 'npm:dependent', { targets: ['claude'] })
	edit(CLAUDE, (catalog) => {
		;(catalog.plugins as Record<string, unknown>[])[1].dependencies = ['base']
	})
	const before = fs.readFileSync(path.join(root, CLAUDE), 'utf8')

	expect(() => removeMarketplaceEntry(root, 'base')).toThrow(/dependency "base" is not listed[\s\S]*--force/)
	expect(fs.readFileSync(path.join(root, CLAUDE), 'utf8')).toBe(before)

	const { results, warnings } = removeMarketplaceEntry(root, 'base', { force: true })
	expect(results[0]?.status).toBe('removed')
	expect(warnings).toEqual([expect.stringMatching(/removed "base" anyway[\s\S]*dependency "base"/)])
	expect(names(CLAUDE)).toEqual(['dependent'])
})

test('warns that a plugin still in the repository will be listed again', () => {
	fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
	fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
	addToMarketplace(root, './plugins/alpha', { targets: ['claude', 'codex'] })

	const { warnings } = removeMarketplaceEntry(root, 'alpha')

	expect(warnings).toEqual([expect.stringMatching(/plugin\.json at \.\/plugins\/alpha.*list it again/)])
})

test('dry run reports the plan and writes nothing', () => {
	addToMarketplace(root, 'npm:alpha', { targets: ['claude'] })
	const before = fs.readFileSync(path.join(root, CLAUDE), 'utf8')

	const { results } = removeMarketplaceEntry(root, 'alpha', { targets: ['claude'], dryRun: true })

	expect(results[0]?.status).toBe('planned')
	expect(fs.readFileSync(path.join(root, CLAUDE), 'utf8')).toBe(before)
})

test('rejects a name outside the catalog grammar', () => {
	expect(() => removeMarketplaceEntry(root, '../x')).toThrow(/plugin name/)
})
