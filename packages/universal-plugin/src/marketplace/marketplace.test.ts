import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from 'vitest'

import { realMarketplaceFs } from './fs.js'
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
			['cursor', 'generated'],
		])
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			$schema: 'https://json.schemastore.org/claude-code-marketplace.json',
			name: path.basename(root),
			owner: { name: 'unional' },
			plugins: [{ name: 'alpha', source: './plugins/alpha', description: 'An alpha plugin' }],
		})
		expect(readJson(root, '.agents/plugins/marketplace.json')).toMatchObject({
			name: path.basename(root),
			interface: { displayName: path.basename(root) },
			plugins: [
				{
					name: 'alpha',
					version: '1.0.0',
					source: { source: 'local', path: './plugins/alpha' },
					policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
					category: 'Productivity',
				},
			],
		})
		expect(readJson(root, '.github/plugin/marketplace.json')).toMatchObject({
			name: path.basename(root),
			owner: { name: 'unional' },
			plugins: [{ name: 'alpha', source: './plugins/alpha' }],
		})
		expect(readJson(root, '.cursor-plugin/marketplace.json')).toMatchObject({
			name: path.basename(root),
			owner: { name: 'unional' },
			plugins: [{ name: 'alpha', source: './plugins/alpha', description: 'An alpha plugin' }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('derives Codex entry versions from canonical plugin manifests and refreshes them on rerun', () => {
	const root = fixture('universal-plugin-marketplace-codex-version-')
	try {
		initializeMarketplace(root, { targets: ['codex'] })
		const manifestPath = path.join(root, 'plugins', 'alpha', 'plugin.json')
		fs.writeFileSync(manifestPath, JSON.stringify({ name: 'alpha', description: 'An alpha plugin', version: '1.1.0' }))

		expect(() => initializeMarketplace(root, { targets: ['codex'] })).toThrow(/--force/)
		expect(initializeMarketplace(root, { targets: ['codex'], force: true })[0]).toMatchObject({
			target: 'codex',
			status: 'generated',
		})
		expect(readJson(root, '.agents/plugins/marketplace.json')).toMatchObject({
			plugins: [{ name: 'alpha', version: '1.1.0' }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

// Codex installs a local plugin under the version its *manifest* carries, and installs an entry that
// declares none just as happily (`.research/local-marketplaces`, E-CODEX-M15, E-CODEX-M16). The entry
// therefore carries a version when there is one to derive and carries none when there is not
// (ADR-0010 §3) — it never requires one.
test('omits the Codex entry version when the canonical manifest declares none', () => {
	const root = fixture('universal-plugin-marketplace-codex-no-version-')
	try {
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
		expect(initializeMarketplace(root, { targets: ['codex'] })[0]).toMatchObject({ status: 'generated' })
		const catalog = readJson(root, '.agents/plugins/marketplace.json') as { plugins: Record<string, unknown>[] }
		expect(catalog.plugins[0]).toMatchObject({ name: 'alpha', source: { source: 'local', path: './plugins/alpha' } })
		expect(catalog.plugins[0]).not.toHaveProperty('version')
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('selects only requested targets and writes Cursor the catalog it documents', () => {
	const root = fixture('universal-plugin-marketplace-cursor-')
	try {
		const result = initializeMarketplace(root, { targets: ['cursor'] })
		expect(result).toMatchObject([{ target: 'cursor', status: 'generated' }])
		expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)
		// The submission scaffold this command used to write rested on Cursor having no
		// repository-local catalog (.research/local-marketplaces). It has one.
		expect(fs.existsSync(path.join(root, '.cursor-plugin/marketplace-submission.json'))).toBe(false)
		expect(fs.existsSync(path.join(root, 'CURSOR_MARKETPLACE_SUBMISSION.md'))).toBe(false)
		expect(readJson(root, '.cursor-plugin/marketplace.json')).toMatchObject({
			name: path.basename(root),
			owner: { name: 'unional' },
			plugins: [{ name: 'alpha', source: './plugins/alpha' }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('carries an object author through to the catalog owner', () => {
	const root = fixture('universal-plugin-marketplace-owner-')
	try {
		fs.writeFileSync(
			path.join(root, 'plugin.json'),
			JSON.stringify({ author: { name: 'Bea', email: 'bea@example.com', url: 'https://example.com' } }),
		)
		initializeMarketplace(root, { targets: ['claude'] })
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			owner: { name: 'Bea', email: 'bea@example.com', url: 'https://example.com' },
		})
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
		const catalog = readJson(root, '.claude-plugin/marketplace.json') as Record<string, unknown>
		fs.writeFileSync(
			path.join(root, '.claude-plugin/marketplace.json'),
			JSON.stringify({ plugins: catalog.plugins, owner: catalog.owner, name: catalog.name, $schema: catalog.$schema }),
		)
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
		expect(initializeMarketplace(empty).map((row) => row.status)).toEqual(['empty', 'empty', 'empty', 'empty'])
	} finally {
		fs.rmSync(empty, { recursive: true, force: true })
	}
})

test('deduplicates explicit scan directories and excludes vendor manifest directories', () => {
	const root = fixture('universal-plugin-marketplace-scan-')
	try {
		fs.mkdirSync(path.join(root, 'extensions', 'beta'), { recursive: true })
		fs.writeFileSync(path.join(root, 'extensions', 'beta', 'plugin.json'), JSON.stringify({ name: 'beta' }))
		fs.mkdirSync(path.join(root, 'extensions', '.plugin'), { recursive: true })
		fs.writeFileSync(path.join(root, 'extensions', '.plugin', 'plugin.json'), JSON.stringify({ name: 'ignored' }))
		const result = initializeMarketplace(root, { targets: ['claude'], scanDirs: ['extensions', 'extensions'] })
		expect(result[0]).toMatchObject({ plugins: ['beta'] })
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			plugins: [{ name: 'beta', source: './extensions/beta' }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('discovers only direct-child marketplace manifests and rejects external symlinks', () => {
	const root = fixture('universal-plugin-marketplace-bounded-')
	const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-marketplace-outside-'))
	try {
		fs.mkdirSync(path.join(root, 'plugins', 'alpha', 'nested'), { recursive: true })
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'nested', 'plugin.json'), JSON.stringify({ name: 'nested' }))
		expect(initializeMarketplace(root, { targets: ['claude'] })[0]?.plugins).toEqual(['alpha'])

		fs.mkdirSync(path.join(outside, 'external'))
		fs.writeFileSync(path.join(outside, 'external', 'plugin.json'), JSON.stringify({ name: 'external' }))
		fs.symlinkSync(path.join(outside, 'external'), path.join(root, 'extensions'))
		expect(() => initializeMarketplace(root, { targets: ['claude'], scanDirs: ['extensions'] })).toThrow(
			/within --root/,
		)
		fs.rmSync(path.join(root, 'extensions'))

		fs.symlinkSync(path.join(outside, 'external'), path.join(root, 'plugins', 'external'))
		expect(() => initializeMarketplace(root, { targets: ['claude'], force: true })).toThrow(/within --root/)
		fs.rmSync(path.join(root, 'plugins', 'external'))
		fs.writeFileSync(path.join(outside, 'manifest.json'), JSON.stringify({ name: 'external' }))
		fs.rmSync(path.join(root, 'plugins', 'alpha', 'plugin.json'))
		fs.symlinkSync(path.join(outside, 'manifest.json'), path.join(root, 'plugins', 'alpha', 'plugin.json'))
		expect(() => initializeMarketplace(root, { targets: ['claude'], force: true })).toThrow(/within --root/)
		fs.rmSync(path.join(root, 'plugins', 'alpha', 'plugin.json'))
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))

		fs.rmSync(path.join(root, '.claude-plugin', 'marketplace.json'))
		fs.symlinkSync(outside, path.join(root, '.claude-plugin', 'marketplace.json'))
		expect(() => initializeMarketplace(root, { targets: ['claude'], force: true })).toThrow(/within --root/)
		fs.rmSync(path.join(root, '.claude-plugin', 'marketplace.json'))
		fs.rmSync(path.join(root, '.claude-plugin'), { recursive: true })
		fs.symlinkSync(outside, path.join(root, '.claude-plugin'))
		expect(() => initializeMarketplace(root, { targets: ['claude'], force: true })).toThrow(/within --root/)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
		fs.rmSync(outside, { recursive: true, force: true })
	}
})

test('reports a later selected-artifact write failure', () => {
	const root = fixture('universal-plugin-marketplace-rollback-')
	try {
		initializeMarketplace(root, { targets: ['claude', 'copilot'] })
		const claude = path.join(root, '.claude-plugin', 'marketplace.json')
		const copilot = path.join(root, '.github', 'plugin', 'marketplace.json')
		fs.writeFileSync(claude, '{"old":"claude"}\n')
		fs.writeFileSync(copilot, '{"old":"copilot"}\n')
		const beforeCopilot = fs.readFileSync(copilot, 'utf8')
		let failOnce = true
		const failingFs = {
			...realMarketplaceFs,
			writeAtomically(file: string, content: string) {
				if (file === copilot && failOnce) {
					failOnce = false
					throw new Error('write failed')
				}
				realMarketplaceFs.writeAtomically(file, content)
			},
		}
		expect(() => initializeMarketplace(root, { targets: ['claude', 'copilot'], force: true }, failingFs)).toThrow(
			/write failed/,
		)
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			plugins: [{ name: 'alpha', source: './plugins/alpha' }],
		})
		expect(fs.readFileSync(copilot, 'utf8')).toBe(beforeCopilot)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

// A manifest written from a package.json carries `repository` as `{ type, url }` and may carry
// keywords that are not an array of strings. Every catalog wants the URL alone: Claude Code refuses
// an entry whose `repository` is an object, so the entry carries the reducible value or nothing.
test('carries npm-shaped manifest metadata into entries in the shape the catalog schema states', () => {
	const root = fixture('universal-plugin-marketplace-npm-metadata-')
	try {
		fs.writeFileSync(
			path.join(root, 'plugins', 'alpha', 'plugin.json'),
			JSON.stringify({
				name: 'alpha',
				version: '1.3.2',
				repository: { type: 'git', url: 'git+https://github.com/repobuddy/repobuddy.git' },
				keywords: 'cli',
				license: 'MIT',
			}),
		)
		initializeMarketplace(root, { targets: ['claude'], force: true })
		const catalog = readJson(root, '.claude-plugin/marketplace.json') as {
			plugins: Record<string, unknown>[]
		}
		expect(catalog.plugins[0]).toMatchObject({
			repository: 'https://github.com/repobuddy/repobuddy.git',
			license: 'MIT',
		})
		expect(catalog.plugins[0]).not.toHaveProperty('keywords')
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('drops manifest metadata it cannot reduce to the catalog shape', () => {
	const root = fixture('universal-plugin-marketplace-npm-shaped-metadata-')
	try {
		fs.writeFileSync(
			path.join(root, 'plugins', 'alpha', 'plugin.json'),
			JSON.stringify({ name: 'alpha', homepage: { url: 'https://example.com' } }),
		)
		initializeMarketplace(root, { targets: ['claude'], force: true })
		// A homepage that is not a string is dropped rather than written, so the catalog stays loadable.
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			plugins: [{ name: 'alpha', source: './plugins/alpha' }],
		})
		expect(readJson(root, '.claude-plugin/marketplace.json')).not.toHaveProperty('plugins[0].homepage')
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})
