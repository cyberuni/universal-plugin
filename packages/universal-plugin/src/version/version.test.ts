import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { composeScript, embeddedData, type ScriptData } from '../compile/scripts.js'
import { realVersionFs } from './fs.js'
import {
	currentVersion,
	PINS_MAP_PATH,
	planVersion,
	RELEASE_TYPES,
	resolveTarget,
	UNSTAMPED_VERSION,
	type VersionState,
} from './version.js'

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
		const result = plan(withPackage, '1.3.0')
		expect(result.to).toBe('1.3.0')
		expect(result.manifest.version).toBe('1.3.0')
		expect(result.packageJson?.content.version).toBe('1.3.0')
		expect(result.packageJson?.path).toBe('packages/mypkg/package.json')
	})

	it('the package.json keeps its other fields', () => {
		const result = plan(
			{ packagePath: 'pkg', packageJson: { name: 'mypkg', scripts: { build: 'x' }, version: '1.2.3' } },
			'1.2.4',
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
		const result = plan(withPackage, '1.2.4')
		expect(result.rows).toEqual([
			{ path: 'plugin.json', action: 'updated' },
			{ path: 'packages/mypkg/package.json', action: 'updated' },
		])
		expect(result.summary.updated).toBe(2)
	})

	it('a packagePath of "." resolves to the root package.json', () => {
		const result = plan({ packagePath: '.', packageJson: { version: '1.2.3' } }, '1.2.4')
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

describe('planVersion — only one place picks the number (ADR-0010 §2)', () => {
	const withPackage: Partial<VersionState> = {
		packagePath: 'packages/mypkg',
		packageJson: { name: 'mypkg', version: '1.3.0' },
	}
	const fromPackage = (state: Partial<VersionState>) =>
		planVersion({ ...base, ...state }, { fromPackage: true, force: false })

	it('refuses a release type where packagePath is declared and points at --from-package', () => {
		expect(() => plan(withPackage, 'minor')).toThrow(/packages\/mypkg\/package\.json.*--from-package/s)
	})

	it('still takes an explicit version where packagePath is declared — semantic-release calls it', () => {
		expect(plan(withPackage, '1.4.0').to).toBe('1.4.0')
	})

	it('--from-package takes the declared package version and leaves the package alone', () => {
		const result = fromPackage(withPackage)
		expect(result.to).toBe('1.3.0')
		expect(result.manifest.version).toBe('1.3.0')
		expect(result.packageJson).toBeNull()
		expect(result.rows.map((r) => r.path)).toEqual(['plugin.json'])
	})

	it('--from-package re-stamps the version the manifest already carries, without --force', () => {
		expect(fromPackage({ ...withPackage, manifest: { name: 'x', version: '1.3.0' } }).to).toBe('1.3.0')
	})

	it('--from-package reads the plugin root package.json when no packagePath is declared', () => {
		expect(fromPackage({ rootPackageJson: { name: 'p', version: '2.0.0' } }).to).toBe('2.0.0')
	})

	it('--from-package names both places it looked when there is no package', () => {
		expect(() => fromPackage({})).toThrow(/packagePath is not set.*plugin root has no package\.json/s)
	})

	it('--from-package refuses a package without a version', () => {
		expect(() => fromPackage({ rootPackageJson: { name: 'p' } })).toThrow(/No version found in package\.json/)
	})

	it('--from-package refuses the semantic-release placeholder and points at the explicit form', () => {
		expect(() => fromPackage({ rootPackageJson: { version: UNSTAMPED_VERSION } })).toThrow(/0\.0\.0-development/)
	})

	it('a version and --from-package together are refused', () => {
		expect(() => planVersion(base, { bump: '1.4.0', fromPackage: true, force: false })).toThrow(/not both/)
	})

	it('neither a version nor --from-package is refused', () => {
		expect(() => planVersion(base, { force: false })).toThrow(/--from-package/)
	})

	it('an explicit version replaces an unstamped manifest without --force', () => {
		expect(plan({ manifest: { name: 'x', version: UNSTAMPED_VERSION } }, '1.0.0').to).toBe('1.0.0')
	})
})

describe('planVersion — stamp the skills', () => {
	const skill = (content: string, rel = 'skills/a/SKILL.md') => ({ path: rel, content })
	const own: Partial<VersionState> = { rootPackageJson: { name: 'my-cli', version: '1.2.3' } }

	it("stamps the plugin's own pins with the new version, in Markdown and scripts alike", () => {
		const result = plan(
			{
				...own,
				skillFiles: [
					skill('Run `npx -y my-cli@1.2.3 go`.'),
					skill("spawnSync('npx', 'npx my-cli@1.2.3'.split(' '))", 'skills/a/scripts/run.mjs'),
					skill('See `upx my-cli@1.2.3 help`.', 'skills/a/references/more.md'),
				],
			},
			'1.3.0',
		)
		expect(result.files).toEqual([
			skill('Run `npx -y my-cli@1.3.0 go`.'),
			skill("spawnSync('npx', 'npx my-cli@1.3.0'.split(' '))", 'skills/a/scripts/run.mjs'),
			skill('See `upx my-cli@1.3.0 help`.', 'skills/a/references/more.md'),
		])
		expect(result.rows.filter((r) => r.action === 'stamped').map((r) => r.path)).toContain('skills/a/scripts/run.mjs')
	})

	it('pins another workspace CLI to its workspace version and leaves an external one alone', () => {
		const result = plan(
			{ ...own, skillFiles: [skill('npx tool@0.1.0 && npx far-away@3.0.0')], workspace: { tool: '0.2.0' } },
			'1.3.0',
		)
		expect(result.files[0]?.content).toBe('npx tool@0.2.0 && npx far-away@3.0.0')
	})

	it('leaves a pin-exempt skill alone', () => {
		const result = plan(
			{
				...own,
				skillFiles: [
					skill('---\nmetadata:\n  pin-exempt: true\n---\nnpx my-cli@1.0.0'),
					skill('npx my-cli@1.0.0', 'skills/a/scripts/x.mjs'),
				],
			},
			'1.3.0',
		)
		expect(result.files).toEqual([])
	})

	it('maps the resolved pins into .plugin/pins.json', () => {
		const result = plan(
			{ ...own, skillFiles: [skill('npx tool@0.1.0 npx my-cli@1.2.3 npx far@1.0.0')], workspace: { tool: '0.2.0' } },
			'1.3.0',
		)
		expect(result.json).toContainEqual({ path: PINS_MAP_PATH, content: { 'my-cli': '1.3.0', tool: '0.2.0' } })
	})

	it('writes no pins map for a plugin whose skills pin nothing it versions', () => {
		expect(plan({ ...own, skillFiles: [skill('npx far@1.0.0')] }, '1.3.0').json).toEqual([])
	})

	it('keeps an existing pins map current even when it is now empty', () => {
		expect(plan({ ...own, pinsMapExists: true }, '1.3.0').json).toEqual([{ path: PINS_MAP_PATH, content: {} }])
	})
})

describe('planVersion — stamp compiled skill scripts (#177)', () => {
	const own: Partial<VersionState> = { rootPackageJson: { name: 'my-cli', version: '1.2.3' } }
	const rel = 'skills/a/scripts/a.mjs'
	const data = (version: string | null): ScriptData => ({
		package: 'my-cli',
		bin: 'my-cli',
		version,
		entry: rel,
		commands: { go: rel },
	})
	const compiled = (version: string | null, code = 'run()\n') =>
		composeScript(code, { output: rel, source: 'src/a.ts' }, data(version))

	it('stamps the version a compiled script embeds, and nothing else in it', () => {
		const result = plan({ ...own, skillFiles: [{ path: rel, content: compiled('1.2.3') }] }, '1.3.0')
		expect(result.files).toEqual([{ path: rel, content: compiled('1.3.0') }])
		expect(result.rows).toContainEqual({ path: rel, action: 'stamped' })
	})

	it('stamps a script compiled before the plugin had a version', () => {
		const result = plan({ ...own, skillFiles: [{ path: rel, content: compiled(null) }] }, '1.3.0')
		expect(embeddedData(result.files[0]?.content ?? '')?.version).toBe('1.3.0')
	})

	it('leaves a pin the compiled code inlines to the build', () => {
		const content = compiled('1.2.3', "spawn('npx my-cli@1.2.3 go')\n")
		const result = plan({ ...own, skillFiles: [{ path: rel, content }] }, '1.3.0')
		expect(result.files).toEqual([{ path: rel, content: compiled('1.3.0', "spawn('npx my-cli@1.2.3 go')\n") }])
	})

	it('writes nothing for a script already on the version', () => {
		const result = plan({ ...own, skillFiles: [{ path: rel, content: compiled('1.3.0') }] }, '1.3.0', { force: true })
		expect(result.files).toEqual([])
	})
})

describe('planVersion — stamp the mcpServers pin (#56)', () => {
	const marked = { command: 'npx', args: ['-y', 'cyber-asana@1.2.3', 'mcp'], pinToPluginVersion: true }
	const ext = (mcpServers: unknown) => ({
		manifest: {
			name: 'p',
			version: '1.2.3',
			extensions: { 'org.cyberuni.universal-plugin': { mcpServers } },
		},
	})

	it('stamps an inline marked entry inside plugin.json and keeps the marker', () => {
		const result = plan(ext({ srv: marked }), '1.3.0')
		const uext = (result.manifest['extensions'] as Record<string, Record<string, any>>)['org.cyberuni.universal-plugin']
		expect(uext?.['mcpServers'].srv).toEqual({ ...marked, args: ['-y', 'cyber-asana@1.3.0', 'mcp'] })
	})

	it('stamps a marked entry in an authored mcp file', () => {
		const result = plan({ mcpFiles: [{ path: 'mcp.json', content: { mcpServers: { srv: marked } } }] }, '1.3.0')
		expect(result.json).toEqual([
			{ path: 'mcp.json', content: { mcpServers: { srv: { ...marked, args: ['-y', 'cyber-asana@1.3.0', 'mcp'] } } } },
		])
	})

	it('leaves an mcp file with nothing to move unwritten', () => {
		const unmarked = { mcpServers: { srv: { command: 'npx', args: ['x@1.0.0'] } } }
		expect(plan({ mcpFiles: [{ path: 'mcp.json', content: unmarked }] }, '1.3.0').json).toEqual([])
	})

	it('warns about a marked entry it cannot stamp', () => {
		const result = plan(ext({ srv: { command: 'node', args: ['s.js'], pinToPluginVersion: true } }), '1.3.0')
		expect(result.warnings.join('\n')).toContain('"srv"')
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
		realVersionFs.apply(dir, planVersion(realVersionFs.gather(dir), { bump: '1.2.4', force: false }))
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
		realVersionFs.apply(dir, planVersion(realVersionFs.gather(dir), { bump: '1.2.4', force: false }))
		expect(readRaw('plugin.json')).toContain('\t')
		expect(readRaw('pkg/package.json')).toContain('\n  ')
		expect(readJson('pkg/package.json').scripts).toEqual({ build: 'x' })
	})
})
