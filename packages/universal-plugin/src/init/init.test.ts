import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { VENDOR_OUTPUT } from '../build/build.js'
import { realInitFs } from './fs.js'
import { buildManifest, type InitState, planInit, wireFiles } from './init.js'

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
		expect(plan.summary).toEqual({ created: 1, updated: 1 })
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

	it('--npm with no package.json writes nothing (guard before manifest write)', () => {
		const state = realInitFs.gather(dir)
		expect(() =>
			planInit(state, { vendors: [], scaffold: false, force: false, npm: true }, path.basename(dir), resolve),
		).toThrow(/package\.json/)
		expect(fs.existsSync(path.join(dir, 'plugin.json'))).toBe(false)
	})
})
