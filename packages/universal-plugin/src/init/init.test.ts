import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { VENDOR_OUTPUT } from '../build/build.js'
import { realInitFs } from './fs.js'
import { buildManifest, type InitOptions, type InitState, planInit, wireFiles } from './init.js'

const resolve = (v: string) => VENDOR_OUTPUT[v as keyof typeof VENDOR_OUTPUT]
const empty: InitState = { manifestExists: false, packageJson: null }

describe('buildManifest', () => {
	it('writes $schema and name, no extensions without vendors', () => {
		const m = buildManifest('my-plugin', [])
		expect(m.name).toBe('my-plugin')
		expect(m.$schema).toBe('https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
		expect(m.extensions).toBeUndefined()
	})

	it('records the vendors list under the extensions namespace when present', () => {
		const m = buildManifest('x', ['claude-code', 'cursor'])
		const ns = (m.extensions as Record<string, { vendors: string[] }>)['org.cyberuni.universal-plugin']
		expect(ns.vendors).toEqual(['claude-code', 'cursor'])
	})

	it('omits the vendors key entirely (never vendors: []) with no vendors', () => {
		expect(JSON.stringify(buildManifest('x', []))).not.toContain('vendors')
	})
})

describe('wireFiles', () => {
	// The open standard is the base layer: the canonical manifest and skills/ ship whatever the
	// vendor targets are. Derived vendor manifests are added on top, never in place of them.
	it('wires the standard base plus the manifest paths, creating the files array', () => {
		const wired = wireFiles({}, ['.claude-plugin/plugin.json'])
		expect(wired.files).toEqual(['plugin.json', 'skills/', '.claude-plugin/plugin.json'])
	})

	it('wires the standard base even with no vendor manifest at all', () => {
		expect(wireFiles({}, []).files).toEqual(['plugin.json', 'skills/'])
	})

	it('preserves existing entries and other fields, never duplicating', () => {
		const wired = wireFiles({ files: ['dist', 'skills/'], scripts: { build: 'x' } }, ['.claude-plugin/plugin.json'])
		expect(wired.files).toEqual(['dist', 'skills/', 'plugin.json', '.claude-plugin/plugin.json'])
		expect(wired.scripts).toEqual({ build: 'x' })
	})
})

describe('planInit guards', () => {
	it('an existing manifest without --force fails pointing at --force', () => {
		const state: InitState = { manifestExists: true, packageJson: null }
		expect(() => planInit(state, { vendors: [], scaffold: false, force: false, npm: false }, 'root', resolve)).toThrow(
			/already exists.*--force|--force/,
		)
	})

	it('--npm with no package.json fails naming package.json', () => {
		expect(() => planInit(empty, { vendors: [], scaffold: false, force: false, npm: true }, 'root', resolve)).toThrow(
			/package\.json/,
		)
	})
})

describe('planInit scaffold half', () => {
	it('defaults the name to the root directory name', () => {
		const plan = planInit(empty, { vendors: [], scaffold: false, force: false, npm: false }, 'cool-plugin', resolve)
		expect(plan.manifest.name).toBe('cool-plugin')
	})

	it('--name overrides the default', () => {
		const plan = planInit(
			empty,
			{ name: 'my-plugin', vendors: [], scaffold: false, force: false, npm: false },
			'root',
			resolve,
		)
		expect(plan.manifest.name).toBe('my-plugin')
	})

	it('--scaffold plans the four standard directories', () => {
		const plan = planInit(empty, { vendors: [], scaffold: true, force: false, npm: false }, 'root', resolve)
		expect(plan.dirs).toEqual(['skills', 'agents', 'governances', 'commands'])
	})

	it('without --scaffold plans no directories', () => {
		const plan = planInit(empty, { vendors: [], scaffold: false, force: false, npm: false }, 'root', resolve)
		expect(plan.dirs).toEqual([])
	})
})

describe('planInit publish half', () => {
	it('--npm defaults to the standard base plus the claude-code manifest path', () => {
		const state: InitState = { manifestExists: false, packageJson: {} }
		const plan = planInit(state, { vendors: [], scaffold: false, force: false, npm: true }, 'root', resolve)
		expect(plan.packageJson?.files).toEqual(['plugin.json', 'skills/', '.claude-plugin/plugin.json'])
	})

	it('--npm wires each named vendor path', () => {
		const state: InitState = { manifestExists: false, packageJson: {} }
		const plan = planInit(
			state,
			{ vendors: ['claude-code', 'cursor'], scaffold: false, force: false, npm: true },
			'root',
			resolve,
		)
		expect(plan.packageJson?.files).toContain('.claude-plugin/plugin.json')
		expect(plan.packageJson?.files).toContain('.cursor-plugin/plugin.json')
	})

	it('re-running --npm adds nothing new (idempotent)', () => {
		const state: InitState = {
			manifestExists: true,
			packageJson: { files: ['.claude-plugin/plugin.json', 'skills/'] },
		}
		const plan = planInit(state, { vendors: [], scaffold: false, force: true, npm: true }, 'root', resolve)
		const claudePaths = (plan.packageJson?.files as string[]).filter((f) => f === '.claude-plugin/plugin.json')
		expect(claudePaths).toHaveLength(1)
	})

	it('reports a package.json updated row and a created plugin.json row', () => {
		const state: InitState = { manifestExists: false, packageJson: {} }
		const plan = planInit(state, { vendors: [], scaffold: false, force: false, npm: true }, 'root', resolve)
		expect(plan.rows).toEqual([
			{ path: 'plugin.json', action: 'created' },
			{ path: 'package.json', action: 'updated' },
		])
		expect(plan.summary).toEqual({ created: 1, updated: 1, unchanged: 0 })
	})
})

describe('planInit marketplace half', () => {
	// A repository the plugin sits two levels down in, with a remote and no catalogs yet.
	const repo = (over: Partial<NonNullable<InitState['repo']>> = {}): InitState => ({
		manifestExists: false,
		packageJson: null,
		repo: {
			pluginPath: 'packages/my-plugin',
			dirName: 'uip-pods',
			slug: { owner: 'pan', repo: 'uip-pods' },
			catalogs: {},
			...over,
		},
	})

	const plan = (state: InitState, vendors: string[], over: Partial<InitOptions> = {}) =>
		planInit(state, { vendors, scaffold: false, force: false, npm: false, ...over }, 'my-plugin', resolve)

	const catalog = (result: ReturnType<typeof planInit>, path: string) => {
		const artifact = result.catalogs.find((entry) => entry.path.endsWith(path))
		if (!artifact) throw new Error(`no catalog planned at ${path}`)
		return JSON.parse(artifact.content)
	}

	it('writes a catalog per selected vendor, at the repository root', () => {
		const result = plan(repo(), ['claude-code', 'cursor'])
		expect(result.catalogs.map((entry) => entry.path)).toEqual([
			'../../.claude-plugin/marketplace.json',
			'../../.cursor-plugin/marketplace.json',
		])
		expect(result.rows).toContainEqual({ path: '../../.claude-plugin/marketplace.json', action: 'created' })
	})

	it('sources the entry at the plugin package, relative to the repository root', () => {
		expect(catalog(plan(repo(), ['claude-code']), '.claude-plugin/marketplace.json')).toMatchObject({
			plugins: [{ name: 'my-plugin', source: './packages/my-plugin' }],
		})
	})

	it('sources a repository-root plugin at the marketplace root', () => {
		expect(catalog(plan(repo({ pluginPath: '' }), ['claude-code']), '.claude-plugin/marketplace.json')).toMatchObject({
			plugins: [{ source: './' }],
		})
		expect(plan(repo({ pluginPath: '' }), ['claude-code']).catalogs[0]?.path).toBe('.claude-plugin/marketplace.json')
	})

	it('names the marketplace after the repository slug, marked local', () => {
		expect(catalog(plan(repo(), ['claude-code']), 'marketplace.json')).toMatchObject({
			name: 'pan-uip-pods-local',
			owner: { name: 'pan' },
		})
	})

	it('falls back to the repository directory name, and to the package author, without a remote', () => {
		const state = { ...repo({ slug: undefined }), packageJson: { author: 'Bea <bea@example.com>' } }
		expect(catalog(plan(state, ['claude-code']), 'marketplace.json')).toMatchObject({
			name: 'uip-pods-local',
			owner: { name: 'Bea' },
		})
	})

	it('keeps the name, the owner, and every other plugin of a catalog that already exists', () => {
		const existing = JSON.stringify({
			$schema: 'https://json.schemastore.org/claude-code-marketplace.json',
			name: 'hand-named',
			owner: { name: 'Bea', email: 'bea@example.com' },
			description: 'Ours',
			plugins: [
				{ name: 'other', source: './packages/other' },
				{ name: 'my-plugin', source: './old/path', tags: ['keep'], version: '9.9.9' },
			],
		})
		const result = catalog(
			plan(repo({ catalogs: { '.claude-plugin/marketplace.json': existing } }), ['claude-code']),
			'marketplace.json',
		)
		expect(result).toMatchObject({
			name: 'hand-named',
			owner: { name: 'Bea', email: 'bea@example.com' },
			description: 'Ours',
		})
		expect(result.plugins[0]).toMatchObject({ name: 'other', source: './packages/other' })
		// The entry is re-derived in place: its source moves, hand-added fields stay, and the
		// hand-authored version goes, because the canonical manifest declares none (ADR-0010 §3).
		expect(result.plugins[1]).toEqual({ name: 'my-plugin', source: './packages/my-plugin', tags: ['keep'] })
	})

	it('reports an existing identical catalog as unchanged', () => {
		const first = plan(repo(), ['claude-code'])
		const second = plan(repo({ catalogs: { '.claude-plugin/marketplace.json': first.catalogs[0]?.content ?? '' } }), [
			'claude-code',
		])
		expect(second.rows).toContainEqual({ path: '../../.claude-plugin/marketplace.json', action: 'unchanged' })
		expect(second.summary).toMatchObject({ unchanged: 1 })
	})

	it('plans no catalog without --vendor, or with --no-marketplace', () => {
		expect(plan(repo(), []).catalogs).toEqual([])
		expect(plan(repo(), ['claude-code'], { marketplace: false }).catalogs).toEqual([])
	})

	it('skips the catalogs, with a note, when no owner can be derived', () => {
		const result = plan(repo({ slug: undefined }), ['claude-code'])
		expect(result.catalogs).toEqual([])
		expect(result.notes.join(' ')).toMatch(/owner/)
	})

	it('skips the catalogs, with a note, outside a repository', () => {
		const result = plan({ manifestExists: false, packageJson: null }, ['claude-code'])
		expect(result.catalogs).toEqual([])
		expect(result.notes.join(' ')).toMatch(/repository/)
	})

	// Codex installs a versionless catalog entry without complaint — the version it caches by comes
	// from the plugin manifest (`.research/local-marketplaces`, E-CODEX-M15, E-CODEX-M16). The entry
	// the scaffold writes therefore exists and simply carries no version yet.
	it('writes the Codex catalog for a manifest with no version, and gives the entry none', () => {
		const result = plan(repo(), ['codex', 'claude-code'])
		expect(result.catalogs.map((entry) => entry.path)).toEqual([
			'../../.agents/plugins/marketplace.json',
			'../../.claude-plugin/marketplace.json',
		])
		const codex = JSON.parse(result.catalogs[0]?.content ?? '{}')
		expect(codex.plugins[0]).toMatchObject({
			name: 'my-plugin',
			source: { source: 'local', path: './packages/my-plugin' },
		})
		expect(codex.plugins[0]).not.toHaveProperty('version')
		expect(result.notes).toEqual([])
	})
})

describe('realInitFs integration', () => {
	let dir: string

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-init-'))
	})
	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true })
	})

	it('gathers state and writes the canonical plugin.json', () => {
		const state = realInitFs.gather(dir)
		const plan = planInit(
			state,
			{ vendors: [], scaffold: false, force: false, npm: false },
			path.basename(dir),
			resolve,
		)
		realInitFs.apply(dir, plan)
		const written = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'))
		expect(written.name).toBe(path.basename(dir))
		expect(fs.existsSync(path.join(dir, 'skills'))).toBe(false)
	})

	it('--npm wires the derived manifest path into package.json files', () => {
		fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'p', files: ['dist'] }, null, 2))
		const state = realInitFs.gather(dir)
		const plan = planInit(state, { vendors: [], scaffold: false, force: false, npm: true }, path.basename(dir), resolve)
		realInitFs.apply(dir, plan)
		const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
		expect(pkg.files).toContain('dist')
		expect(pkg.files).toContain('.claude-plugin/plugin.json')
		expect(pkg.files).toContain('skills/')
	})

	it('registers the plugin in the repository-root catalogs, then converges', () => {
		execFileSync('git', ['-C', dir, 'init', '-q'])
		execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', 'git@github.com:pan/uip-pods.git'])
		const pluginRoot = path.join(dir, 'packages', 'my-plugin')
		fs.mkdirSync(pluginRoot, { recursive: true })

		const run = () => {
			const state = realInitFs.gather(pluginRoot)
			const plan = planInit(
				state,
				{ vendors: ['claude-code', 'cursor'], scaffold: false, force: true, npm: false },
				'my-plugin',
				resolve,
			)
			realInitFs.apply(pluginRoot, plan)
			return plan
		}

		const first = run()
		expect(first.rows.map((row) => row.action)).toEqual(['created', 'created', 'created'])
		const catalog = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'marketplace.json'), 'utf8'))
		expect(catalog).toMatchObject({
			name: 'pan-uip-pods-local',
			owner: { name: 'pan' },
			plugins: [{ name: 'my-plugin', source: './packages/my-plugin' }],
		})
		expect(fs.existsSync(path.join(dir, '.cursor-plugin', 'marketplace.json'))).toBe(true)

		// Re-running init over the catalogs it wrote changes nothing.
		expect(run().rows.map((row) => row.action)).toEqual(['created', 'unchanged', 'unchanged'])
	})

	it('--npm with no package.json writes nothing (guard before manifest write)', () => {
		const state = realInitFs.gather(dir)
		expect(() =>
			planInit(state, { vendors: [], scaffold: false, force: false, npm: true }, path.basename(dir), resolve),
		).toThrow(/package\.json/)
		expect(fs.existsSync(path.join(dir, 'plugin.json'))).toBe(false)
	})
})
