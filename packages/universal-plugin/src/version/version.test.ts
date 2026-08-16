import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { realVersionFs } from './fs.js'
import { currentVersion, planVersion, RELEASE_TYPES, resolveTarget, type VersionState } from './version.js'

const base: VersionState = {
	manifestExists: true,
	manifest: { name: 'my-plugin', version: '1.2.3' },
	packagePath: null,
	packageJson: null,
}

const plan = (state: Partial<VersionState>, bump: string, opts: { preid?: string; force?: boolean } = {}) =>
	planVersion({ ...base, ...state }, { bump, preid: opts.preid, force: Boolean(opts.force) })

describe('resolveTarget', () => {
	// ── Move the authored version ──
	it('a patch bump moves the canonical manifest version', () => {
		expect(resolveTarget('1.2.3', { bump: 'patch', force: false })).toBe('1.2.4')
	})

	it('a minor bump zeroes the patch component', () => {
		expect(resolveTarget('1.2.3', { bump: 'minor', force: false })).toBe('1.3.0')
	})

	it('a major bump zeroes the minor and patch components', () => {
		expect(resolveTarget('1.2.3', { bump: 'major', force: false })).toBe('2.0.0')
	})

	it('an explicit version is used exactly as given', () => {
		expect(resolveTarget('1.2.3', { bump: '2.0.0-rc.1', force: false })).toBe('2.0.0-rc.1')
	})

	it('--preid names the prerelease identifier', () => {
		expect(resolveTarget('1.2.3', { bump: 'prerelease', preid: 'beta', force: false })).toBe('1.2.4-beta.0')
	})

	it('a prerelease bump increments the existing identifier', () => {
		expect(resolveTarget('1.2.4-beta.0', { bump: 'prerelease', force: false })).toBe('1.2.4-beta.1')
	})

	it('accepts every documented release type', () => {
		for (const type of RELEASE_TYPES) {
			expect(resolveTarget('1.2.3', { bump: type, force: false })).toMatch(/^\d+\.\d+\.\d+/)
		}
	})
})

describe('planVersion — move the authored version', () => {
	it('an explicit version seeds a manifest that has none', () => {
		const result = plan({ manifest: { name: 'x' } }, '0.1.0')
		expect(result.from).toBeNull()
		expect(result.to).toBe('0.1.0')
		expect(result.manifest.version).toBe('0.1.0')
	})

	it('every other manifest field is preserved', () => {
		const result = plan({ manifest: { name: 'my-plugin', description: 'desc', version: '1.2.3' } }, 'patch')
		expect(result.manifest.name).toBe('my-plugin')
		expect(result.manifest.description).toBe('desc')
		expect(result.manifest.version).toBe('1.2.4')
	})
})

describe('planVersion — keep the npm package.json in lockstep', () => {
	const withPackage: Partial<VersionState> = {
		packagePath: 'packages/mypkg',
		packageJson: { name: 'mypkg', version: '1.2.3' },
	}

	it('the packagePath package.json moves to the same version', () => {
		const result = plan(withPackage, 'minor')
		expect(result.to).toBe('1.3.0')
		expect(result.manifest.version).toBe('1.3.0')
		expect(result.packageJson?.content.version).toBe('1.3.0')
		expect(result.packageJson?.path).toBe('packages/mypkg/package.json')
	})

	it('the package.json keeps its other fields', () => {
		const result = plan(
			{ packagePath: 'pkg', packageJson: { name: 'mypkg', scripts: { build: 'x' }, version: '1.2.3' } },
			'patch',
		)
		expect(result.packageJson?.content.name).toBe('mypkg')
		expect(result.packageJson?.content.scripts).toEqual({ build: 'x' })
	})

	it('without a declared packagePath only the manifest is written', () => {
		const result = plan({}, 'patch')
		expect(result.packageJson).toBeNull()
		expect(result.rows.map((r) => r.path)).toEqual(['plugin.json'])
	})

	it('both authored files are reported as updated', () => {
		const result = plan(withPackage, 'patch')
		expect(result.rows).toEqual([
			{ path: 'plugin.json', action: 'updated' },
			{ path: 'packages/mypkg/package.json', action: 'updated' },
		])
		expect(result.summary.updated).toBe(2)
	})

	it('a packagePath of "." resolves to the root package.json', () => {
		const result = plan({ packagePath: '.', packageJson: { version: '1.2.3' } }, 'patch')
		expect(result.packageJson?.path).toBe('package.json')
	})
})

describe('planVersion — guards', () => {
	it('a missing canonical manifest fails loud', () => {
		expect(() => plan({ manifestExists: false, manifest: null }, 'patch')).toThrow(/plugin\.json/)
	})

	it('a release type with no current version points at an explicit version', () => {
		expect(() => plan({ manifest: { name: 'x' } }, 'patch')).toThrow(/no version.*explicit version/s)
	})

	it('an unrecognized bump argument names the accepted values', () => {
		expect(() => plan({}, 'frobnicate')).toThrow(/frobnicate/)
		expect(() => plan({}, 'frobnicate')).toThrow(/major/)
	})

	it('a version that does not advance is refused', () => {
		expect(() => plan({}, '1.0.0')).toThrow(/1\.2\.3/)
		expect(() => plan({}, '1.0.0')).toThrow(/--force/)
	})

	it('the current version is also refused as not advancing', () => {
		expect(() => plan({}, '1.2.3')).toThrow(/--force/)
	})

	it('--force allows a version that does not advance', () => {
		expect(plan({}, '1.0.0', { force: true }).to).toBe('1.0.0')
	})

	it('a declared packagePath with no package.json fails', () => {
		expect(() => plan({ packagePath: 'packages/missing' }, 'patch')).toThrow(/packages\/missing/)
	})

	it('a manifest whose current version is not semver fails loud', () => {
		expect(() => plan({ manifest: { name: 'x', version: 'not-semver' } }, 'patch')).toThrow(/not valid semver/)
	})
})

describe('currentVersion', () => {
	it('reads a string version', () => {
		expect(currentVersion({ version: '1.0.0' })).toBe('1.0.0')
	})

	it('treats a missing, empty, or non-string version as none', () => {
		expect(currentVersion({})).toBeNull()
		expect(currentVersion({ version: '' })).toBeNull()
		expect(currentVersion({ version: 7 })).toBeNull()
		expect(currentVersion(null)).toBeNull()
	})
})

describe('realVersionFs', () => {
	let dir: string

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-version-'))
	})

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true })
	})

	function writeJson(rel: string, value: unknown, indent: string | number = '\t') {
		const target = path.join(dir, rel)
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.writeFileSync(target, JSON.stringify(value, null, indent))
	}

	const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) as Record<string, unknown>
	const readRaw = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8')

	it('gathers an absent manifest as not existing', () => {
		expect(realVersionFs.gather(dir).manifestExists).toBe(false)
	})

	it('gathers no packagePath when .agents/universal-plugin.json is absent', () => {
		writeJson('plugin.json', { name: 'x', version: '1.2.3' })
		expect(realVersionFs.gather(dir).packagePath).toBeNull()
	})

	it('gathers a declared packagePath and its package.json', () => {
		writeJson('plugin.json', { name: 'x', version: '1.2.3' })
		writeJson('.agents/universal-plugin.json', { packagePath: 'packages/mypkg' })
		writeJson('packages/mypkg/package.json', { name: 'mypkg', version: '1.2.3' })
		const state = realVersionFs.gather(dir)
		expect(state.packagePath).toBe('packages/mypkg')
		expect(state.packageJson?.version).toBe('1.2.3')
	})

	it('gathers a declared packagePath with a missing package.json as null', () => {
		writeJson('plugin.json', { name: 'x', version: '1.2.3' })
		writeJson('.agents/universal-plugin.json', { packagePath: 'packages/missing' })
		const state = realVersionFs.gather(dir)
		expect(state.packagePath).toBe('packages/missing')
		expect(state.packageJson).toBeNull()
	})

	it('writes both authored files', () => {
		writeJson('plugin.json', { name: 'x', version: '1.2.3' })
		writeJson('.agents/universal-plugin.json', { packagePath: 'packages/mypkg' })
		writeJson('packages/mypkg/package.json', { name: 'mypkg', version: '1.2.3' })
		realVersionFs.apply(dir, planVersion(realVersionFs.gather(dir), { bump: 'patch', force: false }))
		expect(readJson('plugin.json').version).toBe('1.2.4')
		expect(readJson('packages/mypkg/package.json').version).toBe('1.2.4')
	})

	it('the canonical manifest keeps its own indentation', () => {
		writeJson('plugin.json', { name: 'x', version: '1.2.3' }, 2)
		realVersionFs.apply(dir, planVersion(realVersionFs.gather(dir), { bump: 'patch', force: false }))
		expect(readRaw('plugin.json')).toContain('\n  ')
		expect(readRaw('plugin.json')).not.toContain('\t')
	})

	it('the package.json keeps its own indentation, independent of the manifest', () => {
		writeJson('plugin.json', { name: 'x', version: '1.2.3' }, '\t')
		writeJson('.agents/universal-plugin.json', { packagePath: 'pkg' })
		writeJson('pkg/package.json', { name: 'mypkg', scripts: { build: 'x' }, version: '1.2.3' }, 2)
		realVersionFs.apply(dir, planVersion(realVersionFs.gather(dir), { bump: 'patch', force: false }))
		expect(readRaw('plugin.json')).toContain('\t')
		expect(readRaw('pkg/package.json')).toContain('\n  ')
		expect(readJson('pkg/package.json').scripts).toEqual({ build: 'x' })
	})
})
