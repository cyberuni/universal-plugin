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
