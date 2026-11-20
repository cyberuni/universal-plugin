import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { addToMarketplace } from './add.js'
import { setMarketplaceFields } from './set.js'

const CLAUDE = '.claude-plugin/marketplace.json'
const CODEX = '.agents/plugins/marketplace.json'
const COPILOT = '.github/plugin/marketplace.json'
let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-set-'))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
	addToMarketplace(root, 'npm:alpha', { marketplaceName: 'local', owner: 'unional' })
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

function read(relative: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as Record<string, unknown>
}

test('adds a marketplace to the Claude allowlist, ahead of the entries, and leaves the rest alone', () => {
	const before = read(CLAUDE)
	const codex = fs.readFileSync(path.join(root, CODEX), 'utf8')

	const results = setMarketplaceFields(root, { allowDependenciesOn: ['cyber-uni'] })

	expect(results.map((row) => [row.target, row.status])).toEqual([
		['claude', 'updated'],
		['codex', 'skipped'],
		['copilot', 'skipped'],
		['cursor', 'skipped'],
	])
	const after = read(CLAUDE)
	expect(after).toEqual({ ...before, allowCrossMarketplaceDependenciesOn: ['cyber-uni'] })
	expect(Object.keys(after).at(-1)).toBe('plugins')
	expect(fs.readFileSync(path.join(root, CODEX), 'utf8')).toBe(codex)
	expect(read(COPILOT).allowCrossMarketplaceDependenciesOn).toBeUndefined()
})

test('allowing appends without duplicates, and disallowing the last one drops the key', () => {
	setMarketplaceFields(root, { allowDependenciesOn: ['a', 'b'] })
	setMarketplaceFields(root, { allowDependenciesOn: ['b', 'c'] })
	expect(read(CLAUDE).allowCrossMarketplaceDependenciesOn).toEqual(['a', 'b', 'c'])

	setMarketplaceFields(root, { disallowDependenciesOn: ['a', 'c'] })
	expect(read(CLAUDE).allowCrossMarketplaceDependenciesOn).toEqual(['b'])

	setMarketplaceFields(root, { disallowDependenciesOn: ['b'] })
	expect('allowCrossMarketplaceDependenciesOn' in read(CLAUDE)).toBe(false)
})

test('sets the owner and description in every catalog that carries them, keeping the owner name', () => {
	const results = setMarketplaceFields(root, { ownerEmail: 'me@example.com', description: 'Curated plugins' })

	expect(results.map((row) => [row.target, row.status, row.fields])).toEqual([
		['claude', 'updated', 'description owner'],
		['codex', 'skipped', '-'],
		['copilot', 'updated', 'description owner'],
		['cursor', 'updated', 'description owner'],
	])
	for (const catalog of [CLAUDE, COPILOT]) {
		expect(read(catalog)).toMatchObject({
			owner: { name: 'unional', email: 'me@example.com' },
			description: 'Curated plugins',
		})
	}
	expect(read(CODEX).description).toBeUndefined()
})

test('unsets a field, and an equivalent change is unchanged', () => {
	setMarketplaceFields(root, { ownerEmail: 'me@example.com', allowDependenciesOn: ['x'] })

	setMarketplaceFields(root, { unset: ['owner.email', 'allowCrossMarketplaceDependenciesOn'] })
	expect(read(CLAUDE).owner).toEqual({ name: 'unional' })
	expect('allowCrossMarketplaceDependenciesOn' in read(CLAUDE)).toBe(false)

	const again = setMarketplaceFields(root, { owner: 'unional', targets: ['claude'] })
	expect(again[0]?.status).toBe('unchanged')
})

test('a request that changes nothing or contradicts itself fails', () => {
	expect(() => setMarketplaceFields(root)).toThrow(/nothing to change/)
	expect(() => setMarketplaceFields(root, { allowDependenciesOn: ['x'], disallowDependenciesOn: ['x'] })).toThrow(
		/both allowed and disallowed/,
	)
	expect(() => setMarketplaceFields(root, { description: 'x', unset: ['description'] })).toThrow(/both set and unset/)
	expect(() => setMarketplaceFields(root, { unset: ['owner'] })).toThrow(/--unset takes one of/)
	expect(() => setMarketplaceFields(root, { allowDependenciesOn: ['bad name'] })).toThrow(/marketplace name/)
})

test('a change that would break a catalog writes nothing', () => {
	fs.writeFileSync(
		path.join(root, CLAUDE),
		`${JSON.stringify({ name: 'local', plugins: [{ name: 'alpha', source: { source: 'npm', package: 'alpha' } }] })}\n`,
	)
	const before = fs.readFileSync(path.join(root, CLAUDE), 'utf8')
	// No owner yet: an email alone leaves an owner with no name.
	expect(() => setMarketplaceFields(root, { ownerEmail: 'me@example.com', targets: ['claude'] })).toThrow(
		/owner\.name is required/,
	)
	expect(fs.readFileSync(path.join(root, CLAUDE), 'utf8')).toBe(before)
})

test('dry run reports the plan and writes nothing', () => {
	const before = fs.readFileSync(path.join(root, CLAUDE), 'utf8')
	const results = setMarketplaceFields(root, { allowDependenciesOn: ['x'], dryRun: true })
	expect(results[0]?.status).toBe('planned')
	expect(fs.readFileSync(path.join(root, CLAUDE), 'utf8')).toBe(before)
})

test('no selected catalog fails', () => {
	expect(() => setMarketplaceFields(root, { description: 'x', targets: ['codex'] })).toThrow(
		/no selected catalog carries/,
	)
})
