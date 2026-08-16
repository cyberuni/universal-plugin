import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')

let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-versioncli-'))
})
afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true })
})

function run(...args: string[]) {
	return spawnSync('node', [bin, 'plugin', 'version', ...args, '--root', root], {
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

function writeJson(rel: string, value: unknown, indent: string | number = '\t') {
	const target = path.join(root, rel)
	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, `${JSON.stringify(value, null, indent)}\n`)
}

const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) as Record<string, unknown>
const exists = (rel: string) => fs.existsSync(path.join(root, rel))

function seedManifest(extra: Record<string, unknown> = {}) {
	writeJson('plugin.json', { $schema: 'x', name: 'my-plugin', version: '1.2.3', ...extra })
}

const CLAUDE_HARNESS = {
	extensions: { 'org.cyberuni.universal-plugin': { harnesses: { 'claude-code': {} } } },
}

// ── Move the authored version ──

test('a patch bump moves the canonical manifest version', () => {
	seedManifest()
	const r = run('patch')
	expect(r.status).toBe(0)
	expect(readJson('plugin.json').version).toBe('1.2.4')
})

test('a minor bump zeroes the patch component', () => {
	seedManifest()
	run('minor')
	expect(readJson('plugin.json').version).toBe('1.3.0')
})

test('a major bump zeroes the minor and patch components', () => {
	seedManifest()
	run('major')
	expect(readJson('plugin.json').version).toBe('2.0.0')
})

test('an explicit version is used exactly as given', () => {
	seedManifest()
	run('2.0.0-rc.1')
	expect(readJson('plugin.json').version).toBe('2.0.0-rc.1')
})

test('--preid names the prerelease identifier', () => {
	seedManifest()
	run('prerelease', '--preid', 'beta')
	expect(readJson('plugin.json').version).toBe('1.2.4-beta.0')
})

test('a prerelease bump increments the existing identifier', () => {
	writeJson('plugin.json', { name: 'my-plugin', version: '1.2.4-beta.0' })
	run('prerelease')
	expect(readJson('plugin.json').version).toBe('1.2.4-beta.1')
})

test('an explicit version seeds a manifest that has none', () => {
	writeJson('plugin.json', { name: 'my-plugin' })
	const r = run('0.1.0')
	expect(r.status).toBe(0)
	expect(readJson('plugin.json').version).toBe('0.1.0')
})

test('every other manifest field is preserved', () => {
	seedManifest({ description: 'desc' })
	run('patch')
	const manifest = readJson('plugin.json')
	expect(manifest.name).toBe('my-plugin')
	expect(manifest.description).toBe('desc')
})

test('the canonical manifest keeps its own indentation', () => {
	writeJson('plugin.json', { name: 'my-plugin', version: '1.2.3' }, 2)
	run('patch')
	const raw = fs.readFileSync(path.join(root, 'plugin.json'), 'utf8')
	expect(raw).toContain('\n  ')
	expect(raw).not.toContain('\t')
})

// ── Keep the npm package.json in lockstep ──

test('the packagePath package.json moves to the same version', () => {
	seedManifest()
	writeJson('.agents/universal-plugin.json', { packagePath: 'packages/mypkg' })
	writeJson('packages/mypkg/package.json', { name: 'mypkg', version: '1.2.3' })
	run('minor')
	expect(readJson('plugin.json').version).toBe('1.3.0')
	expect(readJson('packages/mypkg/package.json').version).toBe('1.3.0')
})

test('the package.json keeps its other fields and its own indentation', () => {
	seedManifest()
	writeJson('.agents/universal-plugin.json', { packagePath: 'packages/mypkg' })
	writeJson('packages/mypkg/package.json', { name: 'mypkg', scripts: { build: 'x' }, version: '1.2.3' }, 2)
	run('patch')
	const raw = fs.readFileSync(path.join(root, 'packages/mypkg/package.json'), 'utf8')
	expect(raw).toContain('\n  ')
	expect(readJson('packages/mypkg/package.json').scripts).toEqual({ build: 'x' })
})

test('without a declared packagePath only the manifest is written', () => {
	seedManifest()
	const r = run('patch')
	expect(r.status).toBe(0)
	expect(readJson('plugin.json').version).toBe('1.2.4')
	expect(exists('package.json')).toBe(false)
})

test('both authored files are reported as updated', () => {
	seedManifest()
	writeJson('.agents/universal-plugin.json', { packagePath: 'packages/mypkg' })
	writeJson('packages/mypkg/package.json', { name: 'mypkg', version: '1.2.3' })
	const r = run('patch', '--format', 'json')
	const result = JSON.parse(r.stdout) as { written: string[] }
	expect(result.written).toContain('plugin.json')
	expect(result.written).toContain('packages/mypkg/package.json')
})

// ── Re-derive the vendor manifests ──

test('the derived vendor manifest carries the new version', () => {
	seedManifest(CLAUDE_HARNESS)
	const r = run('patch')
	expect(r.status).toBe(0)
	expect(readJson('.claude-plugin/plugin.json').version).toBe('1.2.4')
})

test('--no-build leaves the derived manifests untouched', () => {
	seedManifest(CLAUDE_HARNESS)
	writeJson('.claude-plugin/plugin.json', { name: 'my-plugin', version: '1.2.3' })
	run('patch', '--no-build')
	expect(readJson('plugin.json').version).toBe('1.2.4')
	expect(readJson('.claude-plugin/plugin.json').version).toBe('1.2.3')
})

test('a plugin with no declared harnesses still bumps', () => {
	seedManifest()
	const r = run('patch')
	expect(r.status).toBe(0)
	expect(readJson('plugin.json').version).toBe('1.2.4')
})

// ── Guards ──

test('a missing canonical manifest fails loud', () => {
	const r = run('patch')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('plugin.json')
})

test('a release type with no current version points at an explicit version', () => {
	writeJson('plugin.json', { name: 'my-plugin' })
	const r = run('patch')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('no version')
	expect(r.stderr).toContain('explicit version')
})

test('an unrecognized bump argument names the accepted values', () => {
	seedManifest()
	const r = run('frobnicate')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('frobnicate')
	expect(r.stderr).toContain('major')
})

test('a version that does not advance is refused', () => {
	seedManifest()
	const r = run('1.0.0')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('1.2.3')
	expect(r.stderr).toContain('--force')
})

test('--force allows a version that does not advance', () => {
	seedManifest()
	const r = run('1.0.0', '--force')
	expect(r.status).toBe(0)
	expect(readJson('plugin.json').version).toBe('1.0.0')
})

test('a declared packagePath with no package.json fails before any write', () => {
	seedManifest()
	writeJson('.agents/universal-plugin.json', { packagePath: 'packages/missing' })
	const r = run('patch')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('packages/missing')
	expect(readJson('plugin.json').version).toBe('1.2.3')
})

test('a failing guard leaves every file untouched', () => {
	seedManifest(CLAUDE_HARNESS)
	const r = run('frobnicate')
	expect(r.status).toBe(1)
	expect(readJson('plugin.json').version).toBe('1.2.3')
	expect(exists('.claude-plugin/plugin.json')).toBe(false)
})

test('--dry-run reports the plan and writes nothing', () => {
	seedManifest()
	const r = run('patch', '--dry-run')
	expect(r.status).toBe(0)
	expect(r.stdout).toContain('1.2.4')
	expect(readJson('plugin.json').version).toBe('1.2.3')
})

test('an unknown flag fails loud', () => {
	seedManifest()
	const r = run('patch', '--frobnicate')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('--frobnicate')
})

// ── AXI output contract ──

test('a successful run prints a row per written file plus the updated aggregate', () => {
	seedManifest()
	const r = run('patch')
	expect(r.stdout).toContain('plugin.json')
	expect(r.stdout).toMatch(/updated 1/)
})

test('--format json returns the from, to, and written fields', () => {
	seedManifest()
	const r = run('patch', '--format', 'json')
	const result = JSON.parse(r.stdout) as { from: string; to: string; written: string[] }
	expect(result.from).toBe('1.2.3')
	expect(result.to).toBe('1.2.4')
	expect(result.written).toContain('plugin.json')
})

test('a successful run ends with a next-step line', () => {
	seedManifest()
	const r = run('patch')
	expect(r.stderr).toContain('→ universal-plugin plugin')
})

// ── Print the command reference ──

test('--help prints a concise reference', () => {
	const r = spawnSync('node', [bin, 'plugin', 'version', '--help'], { encoding: 'utf8' })
	expect(r.status).toBe(0)
	expect(r.stdout).toContain('--preid')
	expect(r.stdout).toContain('--no-build')
	expect(r.stdout).toContain('--dry-run')
})
