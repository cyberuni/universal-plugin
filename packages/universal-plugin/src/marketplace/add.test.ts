import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, test } from 'vitest'

import { addToMarketplace } from './add.js'
import { resolveKnownMarketplace } from './fs.js'
import { initializeMarketplace } from './init.js'

function fixture(prefix: string): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
	return root
}

function readJson(root: string, relative: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')) as Record<string, unknown>
}

function entries(root: string, relative: string): Record<string, unknown>[] {
	return (readJson(root, relative).plugins ?? []) as Record<string, unknown>[]
}

/** A marketplace as the runtime would have cloned it, for the `<plugin>@<marketplace>` path.
 *  `remote` gives the clone an origin, which is what a relative source is rewritten against. */
function installedMarketplace(home: string, name: string, plugins: unknown[], remote?: string): string {
	const dir = path.join(home, '.claude', 'plugins', 'marketplaces', name)
	fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true })
	fs.writeFileSync(
		path.join(dir, '.claude-plugin', 'marketplace.json'),
		JSON.stringify({ name, owner: { name: 'someone' }, plugins }),
	)
	if (remote !== undefined) {
		execFileSync('git', ['-C', dir, 'init', '-q'])
		execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', remote])
	}
	return dir
}

test('creates a catalog for a repository that develops no plugins of its own', () => {
	const root = fixture('universal-plugin-add-create-')
	try {
		const result = addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })

		expect(result).toEqual([
			{
				target: 'claude',
				status: 'added',
				entry: 'repobuddy',
				source: 'npm:repobuddy',
				path: '.claude-plugin/marketplace.json',
			},
		])
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({
			name: path.basename(root),
			owner: { name: 'unional' },
			plugins: [{ name: 'repobuddy', source: { source: 'npm', package: 'repobuddy' } }],
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('an npm source reaches the runtimes that install from npm and is skipped for the rest', () => {
	const root = fixture('universal-plugin-add-npm-targets-')
	try {
		const result = addToMarketplace(root, 'npm:repobuddy')

		expect(result.map((row) => [row.target, row.status])).toEqual([
			['claude', 'added'],
			['codex', 'added'],
			['copilot', 'skipped'],
			['cursor', 'skipped'],
		])
		// A skip says which runtime and why, because the alternative is a catalog refused at install.
		expect(result[2]?.reason).toMatch(/npm source is not supported by copilot/)
		expect(fs.existsSync(path.join(root, '.github/plugin/marketplace.json'))).toBe(false)
		expect(entries(root, '.agents/plugins/marketplace.json')[0]).toMatchObject({
			name: 'repobuddy',
			source: { source: 'npm', package: 'repobuddy' },
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('a path source reaches every runtime and takes its metadata from the plugin manifest', () => {
	const root = fixture('universal-plugin-add-path-')
	try {
		fs.mkdirSync(path.join(root, 'vendor', 'beta'), { recursive: true })
		fs.writeFileSync(
			path.join(root, 'vendor', 'beta', 'plugin.json'),
			JSON.stringify({ name: 'beta', version: '3.1.0', description: 'A beta plugin', license: 'MIT' }),
		)

		const result = addToMarketplace(root, './vendor/beta')

		expect(result.every((row) => row.status === 'added')).toBe(true)
		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toEqual({
			name: 'beta',
			source: './vendor/beta',
			description: 'A beta plugin',
			version: '3.1.0',
			license: 'MIT',
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('an installed npm package supplies its own metadata, and flags win over it', () => {
	const root = fixture('universal-plugin-add-node-modules-')
	try {
		fs.mkdirSync(path.join(root, 'node_modules', 'repobuddy'), { recursive: true })
		fs.writeFileSync(
			path.join(root, 'node_modules', 'repobuddy', 'package.json'),
			JSON.stringify({ name: 'repobuddy', version: '1.4.0', description: 'from the installed copy' }),
		)

		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'], metadata: { description: 'from the flag' } })

		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toMatchObject({
			version: '1.4.0',
			description: 'from the flag',
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('copies the source another marketplace already publishes for the plugin', () => {
	const home = fixture('universal-plugin-add-home-')
	const root = fixture('universal-plugin-add-from-marketplace-')
	try {
		const from = installedMarketplace(home, 'cyberplace', [
			{ name: 'repobuddy', source: { source: 'npm', package: 'repobuddy' }, description: 'Repo automation' },
		])

		addToMarketplace(root, 'repobuddy@cyberplace', { targets: ['claude'], from })

		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toMatchObject({
			name: 'repobuddy',
			source: { source: 'npm', package: 'repobuddy' },
			description: 'Repo automation',
		})
	} finally {
		fs.rmSync(home, { recursive: true, force: true })
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('reports what went wrong when a marketplace entry cannot be copied', () => {
	const home = fixture('universal-plugin-add-home-bad-')
	const root = fixture('universal-plugin-add-from-bad-')
	try {
		const from = installedMarketplace(home, 'cyberplace', [
			{ name: 'local-only', source: './plugins/local-only' },
			{ name: 'sourceless' },
		])

		expect(() => addToMarketplace(root, 'ghost@nowhere', { targets: ['claude'] })).toThrow(/is not installed/)
		expect(() => addToMarketplace(root, 'ghost@cyberplace', { targets: ['claude'], from })).toThrow(
			/lists no plugin "ghost"/,
		)
		expect(() => addToMarketplace(root, 'sourceless@cyberplace', { targets: ['claude'], from })).toThrow(
			/names no source/,
		)
		// A `./` source can only be rewritten against a remote, and this clone has none.
		expect(() => addToMarketplace(root, 'local-only@cyberplace', { targets: ['claude'], from })).toThrow(
			/no remote to rewrite its source against/,
		)
	} finally {
		fs.rmSync(home, { recursive: true, force: true })
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('rewrites a source relative to the other marketplace into one that resolves anywhere', () => {
	const home = fixture('universal-plugin-add-home-rewrite-')
	const root = fixture('universal-plugin-add-rewrite-')
	try {
		const from = installedMarketplace(
			home,
			'cyberplace',
			[
				{ name: 'aced', source: './plugins/aced', description: 'Agent config evals' },
				{ name: 'whole-repo', source: './' },
			],
			'https://github.com/cyberuni/cyberplace.git',
		)

		addToMarketplace(root, 'aced@cyberplace', { targets: ['claude'], from })
		addToMarketplace(root, 'whole-repo@cyberplace', { targets: ['claude'], from })

		// A plugin in a subdirectory of the marketplace's own repository is exactly git-subdir.
		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toMatchObject({
			name: 'aced',
			source: { source: 'git-subdir', url: 'https://github.com/cyberuni/cyberplace.git', path: 'plugins/aced' },
			description: 'Agent config evals',
		})
		// One at the repository root needs no subdirectory, so it takes the plainer form.
		expect(entries(root, '.claude-plugin/marketplace.json')[1]).toMatchObject({
			name: 'whole-repo',
			source: { source: 'github', repo: 'cyberuni/cyberplace' },
		})
	} finally {
		fs.rmSync(home, { recursive: true, force: true })
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('a rewritten source reaches only the runtimes that resolve it', () => {
	const home = fixture('universal-plugin-add-home-rewrite-targets-')
	const root = fixture('universal-plugin-add-rewrite-targets-')
	try {
		const from = installedMarketplace(
			home,
			'palo',
			[{ name: 'pods', source: './plugins/pods' }],
			'https://code.pan.run/ui-platform/palo/marketplace.git',
		)

		const result = addToMarketplace(root, 'pods@palo', { from })

		// git-subdir is a Claude Code source form; the other three document local paths only.
		expect(result.map((row) => [row.target, row.status])).toEqual([
			['claude', 'added'],
			['codex', 'skipped'],
			['copilot', 'skipped'],
			['cursor', 'skipped'],
		])
		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toMatchObject({
			source: {
				source: 'git-subdir',
				url: 'https://code.pan.run/ui-platform/palo/marketplace.git',
				path: 'plugins/pods',
			},
		})
	} finally {
		fs.rmSync(home, { recursive: true, force: true })
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('replacing an entry someone already listed needs force, and a rerun changes nothing', () => {
	const root = fixture('universal-plugin-add-force-')
	try {
		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })

		expect(addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })[0]?.status).toBe('unchanged')
		expect(() => addToMarketplace(root, 'cyberuni/repobuddy', { targets: ['claude'], name: 'repobuddy' })).toThrow(
			/already listed differently .*--force/,
		)

		const forced = addToMarketplace(root, 'cyberuni/repobuddy', {
			targets: ['claude'],
			name: 'repobuddy',
			force: true,
		})
		expect(forced[0]?.status).toBe('updated')
		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toMatchObject({
			source: { source: 'github', repo: 'cyberuni/repobuddy' },
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('a dry run reports the plan and writes nothing', () => {
	const root = fixture('universal-plugin-add-dry-run-')
	try {
		const result = addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'], dryRun: true })

		expect(result[0]?.status).toBe('planned')
		expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('an added entry survives the regeneration that discovery drives', () => {
	const root = fixture('universal-plugin-add-compose-')
	try {
		fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
		fs.writeFileSync(path.join(root, 'plugins', 'alpha', 'plugin.json'), JSON.stringify({ name: 'alpha' }))
		initializeMarketplace(root, { targets: ['claude'] })
		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })

		// Not a conflict: `init` has nothing to say about a plugin it could never have discovered.
		expect(initializeMarketplace(root, { targets: ['claude'] })[0]?.status).toBe('unchanged')
		expect(initializeMarketplace(root, { targets: ['claude'], force: true })[0]?.plugins).toEqual([
			'alpha',
			'repobuddy',
		])
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('an entry an owner cannot be derived for fails before anything is written', () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-add-no-owner-'))
	try {
		expect(() => addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'] })).toThrow(/owner is required/)
		expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)

		addToMarketplace(root, 'npm:repobuddy', { targets: ['claude'], owner: 'unional' })
		expect(readJson(root, '.claude-plugin/marketplace.json')).toMatchObject({ owner: { name: 'unional' } })
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})

test('reads a marketplace origin from what the runtime recorded, not only from its clone', () => {
	const home = fixture('universal-plugin-add-registry-')
	try {
		installedMarketplace(home, 'cyberplace', [])
		installedMarketplace(home, 'palo', [])
		fs.writeFileSync(
			path.join(home, '.claude', 'plugins', 'known_marketplaces.json'),
			JSON.stringify({
				cyberplace: {
					source: { source: 'github', repo: 'cyberuni/cyberplace' },
					installLocation: path.join(home, '.claude', 'plugins', 'marketplaces', 'cyberplace'),
				},
				palo: {
					source: { source: 'git', url: 'https://code.pan.run/ui-platform/palo/marketplace.git' },
					installLocation: path.join(home, '.claude', 'plugins', 'marketplaces', 'palo'),
				},
			}),
		)

		// The runtime records a github repo for one and a clone URL for the other; both become an origin.
		expect(resolveKnownMarketplace('cyberplace', undefined, home)?.origin).toEqual({
			url: 'https://github.com/cyberuni/cyberplace.git',
			repo: 'cyberuni/cyberplace',
		})
		expect(resolveKnownMarketplace('palo', undefined, home)?.origin).toEqual({
			url: 'https://code.pan.run/ui-platform/palo/marketplace.git',
		})
		expect(resolveKnownMarketplace('nosuchplace', undefined, home)).toBeUndefined()
	} finally {
		fs.rmSync(home, { recursive: true, force: true })
	}
})

test('lists one plugin out of a monorepo, pinned to a tag', () => {
	const root = fixture('universal-plugin-add-subdir-')
	try {
		const result = addToMarketplace(root, 'cyberuni/cyber-sdd', {
			subdir: 'plugins/aced',
			ref: 'v1.2.0',
			metadata: { description: 'Agent config evals' },
		})

		// git-subdir is a Claude Code source form, so the other three cannot resolve it.
		expect(result.map((row) => [row.target, row.status])).toEqual([
			['claude', 'added'],
			['codex', 'skipped'],
			['copilot', 'skipped'],
			['cursor', 'skipped'],
		])
		// The entry is named for the plugin's directory, not for the repository holding it.
		expect(entries(root, '.claude-plugin/marketplace.json')[0]).toEqual({
			name: 'aced',
			source: {
				source: 'git-subdir',
				url: 'https://github.com/cyberuni/cyber-sdd.git',
				path: 'plugins/aced',
				ref: 'v1.2.0',
			},
			description: 'Agent config evals',
		})
	} finally {
		fs.rmSync(root, { recursive: true, force: true })
	}
})
