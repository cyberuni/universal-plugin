import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from 'vitest'

import { initializeMarketplace } from './init.js'

function fixture(prefix: string): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
	fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
	fs.writeFileSync(
		path.join(root, 'plugins', 'alpha', 'plugin.json'),
		JSON.stringify({ name: 'alpha', description: 'An alpha plugin', version: '1.0.0' }),
	)
	return root
}

function readJson(root: string, relative: string): unknown {
	return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
}

test('generates default Claude, Codex, and Copilot catalogs from root plugin manifests', () => {
	const root = fixture('universal-plugin-marketplace-')
	try {
		const result = initializeMarketplace(root)
		expect(result.map((row) => [row.target, row.status])).toEqual([
			['claude', 'generated'],
			['codex', 'generated'],
			['copilot', 'generated'],
			['cursor', 'skipped-default'],
		])
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			name: path.basename(root),
			owner: 'unional',
			plugins: [{ name: 'alpha', source: './plugins/alpha', description: 'An alpha plugin' }],
		})
		expect(readJson(root, '.agents/plugins/marketplace.json')).toMatchObject({
			name: path.basename(root),
			interface: { displayName: path.basename(root) },
			plugins: [
				{
					name: 'alpha',
					source: { source: 'local', path: './plugins/alpha' },
					policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
					category: 'Productivity',
				},
			],
		})
		expect(readJson(root, '.github/plugin/marketplace.json')).toMatchObject({
			name: path.basename(root),
			owner: 'unional',
			plugins: [{ name: 'alpha', source: './plugins/alpha' }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('selects only requested targets and creates the Cursor non-provisioning scaffold', () => {
	const root = fixture('universal-plugin-marketplace-cursor-')
	try {
		const result = initializeMarketplace(root, { targets: ['cursor'] })
		expect(result).toMatchObject([{ target: 'cursor', status: 'generated' }])
		expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)
		expect(readJson(root, '.cursor-plugin/marketplace-submission.json')).toMatchObject({
			name: path.basename(root),
			owner: 'unional',
			plugins: [{ name: 'alpha', source: './plugins/alpha' }],
		})
		expect(fs.readFileSync(path.join(root, 'CURSOR_MARKETPLACE_SUBMISSION.md'), 'utf8')).toMatch(
			/no publication or provisioning occurred/i,
		)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('validates explicit roots and every manifest before changing any target', () => {
	const root = fixture('universal-plugin-marketplace-atomic-')
	try {
		fs.mkdirSync(path.join(root, 'plugins', 'broken'))
		fs.writeFileSync(path.join(root, 'plugins', 'broken', 'plugin.json'), '{')
		expect(() => initializeMarketplace(root)).toThrow(/valid JSON/i)
		expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)
		expect(() => initializeMarketplace(root, { scanDirs: ['missing'] })).toThrow(/does not exist/i)
		expect(() => initializeMarketplace(root, { scanDirs: ['../outside'] })).toThrow(/within --root/i)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('supports dry runs, unchanged reruns, force conflicts, empty defaults, and duplicate identities', () => {
	const root = fixture('universal-plugin-marketplace-status-')
	try {
		expect(initializeMarketplace(root, { dryRun: true })[0]).toMatchObject({ status: 'planned' })
		expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)
		initializeMarketplace(root)
		expect(initializeMarketplace(root)[0]).toMatchObject({ status: 'unchanged' })
		fs.writeFileSync(path.join(root, '.claude-plugin/marketplace.json'), '{"different":true}\n')
		expect(() => initializeMarketplace(root)).toThrow(/--force/)
		expect(initializeMarketplace(root, { force: true })[0]).toMatchObject({ status: 'generated' })

		fs.mkdirSync(path.join(root, 'plugins', 'copy'))
		fs.writeFileSync(path.join(root, 'plugins', 'copy', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
		expect(() => initializeMarketplace(root)).toThrow(/duplicate plugin name/i)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}

	const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-marketplace-empty-'))
	try {
		fs.writeFileSync(path.join(empty, 'plugin.json'), JSON.stringify({ author: 'unional' }))
		expect(initializeMarketplace(empty).map((row) => row.status)).toEqual([
			'empty',
			'empty',
			'empty',
			'skipped-default',
		])
	} finally {
		fs.rmSync(empty, { recursive: true, force: true })
	}
})

test('deduplicates explicit scan directories and excludes vendor manifest directories', () => {
	const root = fixture('universal-plugin-marketplace-scan-')
	try {
		fs.mkdirSync(path.join(root, 'extensions', 'beta'), { recursive: true })
		fs.writeFileSync(path.join(root, 'extensions', 'beta', 'plugin.json'), JSON.stringify({ name: 'beta' }))
		fs.mkdirSync(path.join(root, 'extensions', '.plugin', 'ignored'), { recursive: true })
		fs.writeFileSync(
			path.join(root, 'extensions', '.plugin', 'ignored', 'plugin.json'),
			JSON.stringify({ name: 'ignored' }),
		)
		const result = initializeMarketplace(root, { targets: ['claude'], scanDirs: ['extensions', 'extensions'] })
		expect(result[0]).toMatchObject({ plugins: ['beta'] })
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			plugins: [{ name: 'beta', source: './extensions/beta' }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})
