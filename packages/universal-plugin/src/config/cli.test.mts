import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')

let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-config-'))
})
afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true })
})

function run(...args: string[]) {
	return spawnSync('node', [bin, ...args, '--root', root], {
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

const CONFIG = '.agents/universal-plugin.json'

function seed(obj: unknown) {
	fs.mkdirSync(path.join(root, '.agents'), { recursive: true })
	fs.writeFileSync(path.join(root, CONFIG), `${JSON.stringify(obj, null, '\t')}\n`)
}
function readConfig(): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(path.join(root, CONFIG), 'utf8'))
}
function rawConfig(): string {
	return fs.readFileSync(path.join(root, CONFIG), 'utf8')
}

// ── config add: append & replace ──

test('appends a new entry when no name matches', () => {
	seed({ 'sdd-plugins': [{ name: 'quill' }] })
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces","handles":["agent evaluation"]}')
	expect(r.status).toBe(0)
	const arr = readConfig()['sdd-plugins'] as { name: string }[]
	expect(arr.map((e) => e.name)).toEqual(['quill', 'aces'])
})

test('creates the key when it does not yet exist', () => {
	seed({ packagePath: 'packages/universal-plugin' })
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}')
	expect(r.status).toBe(0)
	expect(readConfig()['sdd-plugins']).toEqual([{ name: 'aces' }])
})

test('replaces a same-name entry in place, preserving position, reporting replaced', () => {
	seed({ 'sdd-plugins': [{ name: 'quill' }, { name: 'aces', handles: ['old'] }, { name: 'cyberplace' }] })
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces","handles":["new"]}')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/replaced/)
	expect(readConfig()['sdd-plugins']).toEqual([
		{ name: 'quill' },
		{ name: 'aces', handles: ['new'] },
		{ name: 'cyberplace' },
	])
})

test('re-running the same add is idempotent (file content unchanged)', () => {
	seed({ 'sdd-plugins': [{ name: 'aces', handles: ['new'] }] })
	run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces","handles":["new"]}')
	const before = rawConfig()
	run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces","handles":["new"]}')
	expect(rawConfig()).toBe(before)
})

test('creates the config file when it is absent', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}')
	expect(r.status).toBe(0)
	expect(fs.existsSync(path.join(root, CONFIG))).toBe(true)
	expect(readConfig()['sdd-plugins']).toEqual([{ name: 'aces' }])
})

test('preserves other top-level keys on write', () => {
	seed({ packagePath: 'packages/universal-plugin', 'other-plugins': [{ name: 'x' }], future: 42 })
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}')
	expect(r.status).toBe(0)
	const c = readConfig()
	expect(c.packagePath).toBe('packages/universal-plugin')
	expect(c['other-plugins']).toEqual([{ name: 'x' }])
	expect(c.future).toBe(42)
})

// ── config add: reserved key & validation ──

test('rejects the reserved key packagePath and writes nothing', () => {
	seed({ packagePath: 'packages/universal-plugin' })
	const r = run('config', 'add', '--key', 'packagePath', '--entry', '{"name":"x"}')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/packagePath/)
	expect(r.stderr).toMatch(/reserved/)
	expect(readConfig().packagePath).toBe('packages/universal-plugin')
})

test('an entry with no name fails and writes nothing', () => {
	seed({ 'sdd-plugins': [{ name: 'quill' }] })
	const before = rawConfig()
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"handles":["x"]}')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/name/)
	expect(rawConfig()).toBe(before)
})

test('an entry that is not a JSON object fails and writes nothing', () => {
	seed({ 'sdd-plugins': [] })
	const before = rawConfig()
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '"just a string"')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/JSON object/)
	expect(rawConfig()).toBe(before)
})

test('an entry that is not valid JSON fails and writes nothing', () => {
	seed({ 'sdd-plugins': [] })
	const before = rawConfig()
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{not json}')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/not valid JSON/)
	expect(rawConfig()).toBe(before)
})

test('a missing --key fails naming the flag', () => {
	const r = run('config', 'add', '--entry', '{"name":"aces"}')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--key/)
})

test('a missing --entry fails naming the flag', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--entry/)
})

// ── config add: AXI output ──

test('successful add prints a TOON row and aggregate by default', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/sdd-plugins/)
	expect(r.stdout).toMatch(/aces/)
	expect(r.stdout).toMatch(/appended/)
	expect(r.stdout).toMatch(/sdd-plugins: 1 entries/)
})

test('--format json returns the structured shape', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}', '--format', 'json')
	expect(r.status).toBe(0)
	expect(JSON.parse(r.stdout)).toEqual({ key: 'sdd-plugins', name: 'aces', action: 'appended' })
})

test('--format toon prints a table', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}', '--format', 'toon')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/aces/)
})

test('a successful add suggests config get as the next step', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}')
	expect(r.stderr.trimEnd()).toMatch(/→ universal-plugin config get --key sdd-plugins$/)
})

test('an unknown flag on add exits naming the flag', () => {
	const r = run('config', 'add', '--key', 'sdd-plugins', '--entry', '{"name":"aces"}', '--bogus')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--bogus|bogus/)
})

test('config add --help exits zero with a synopsis and example', () => {
	const r = spawnSync('node', [bin, 'config', 'add', '--help'], { encoding: 'utf8' })
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/--key/)
	expect(r.stdout).toMatch(/Example/)
})

// ── config get ──

test('reads the entries registered at a key', () => {
	seed({ 'sdd-plugins': [{ name: 'aces' }, { name: 'quill' }] })
	const r = run('config', 'get', '--key', 'sdd-plugins')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/aces/)
	expect(r.stdout).toMatch(/quill/)
})

test('default get output is a TOON result keyed on name with an aggregate', () => {
	seed({ 'sdd-plugins': [{ name: 'aces' }, { name: 'quill' }] })
	const r = run('config', 'get', '--key', 'sdd-plugins')
	expect(r.stdout).toMatch(/NAME/)
	expect(r.stdout).toMatch(/sdd-plugins: 2 entries/)
})

test('get --format json returns the raw stored array', () => {
	const stored = [{ name: 'aces', handles: ['agent evaluation'] }]
	seed({ 'sdd-plugins': stored })
	const r = run('config', 'get', '--key', 'sdd-plugins', '--format', 'json')
	expect(r.status).toBe(0)
	expect(JSON.parse(r.stdout)).toEqual(stored)
})

test('get --format toon prints a table', () => {
	seed({ 'sdd-plugins': [{ name: 'aces' }] })
	const r = run('config', 'get', '--key', 'sdd-plugins', '--format', 'toon')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/aces/)
})

test('an absent key prints a definitive empty state', () => {
	seed({ packagePath: 'packages/universal-plugin' })
	const r = run('config', 'get', '--key', 'sdd-plugins')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/\(none\)/)
	expect(r.stdout).toMatch(/0 entries/)
})

test('a key present with an empty array prints a definitive empty state', () => {
	seed({ 'sdd-plugins': [] })
	const r = run('config', 'get', '--key', 'sdd-plugins')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/\(none\)/)
	expect(r.stdout).toMatch(/0 entries/)
})

test('get --format json on an absent key prints an empty array', () => {
	seed({ packagePath: 'packages/universal-plugin' })
	const r = run('config', 'get', '--key', 'sdd-plugins', '--format', 'json')
	expect(r.status).toBe(0)
	expect(r.stdout.trim()).toBe('[]')
})

test('a missing config file is treated as an absent key', () => {
	const r = run('config', 'get', '--key', 'sdd-plugins')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/0 entries/)
})

test('get rejects the reserved key packagePath', () => {
	seed({ packagePath: 'packages/universal-plugin' })
	const r = run('config', 'get', '--key', 'packagePath')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/packagePath/)
	expect(r.stderr).toMatch(/reserved/)
})

test('a missing --key on get fails naming the flag', () => {
	const r = run('config', 'get')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--key/)
})

test('a get suggests config add as the next step', () => {
	seed({ 'sdd-plugins': [{ name: 'aces' }] })
	const r = run('config', 'get', '--key', 'sdd-plugins')
	expect(r.stderr.trimEnd()).toMatch(/→ universal-plugin config add --key sdd-plugins --entry <json>$/)
})

test('an unknown flag on get exits naming the flag', () => {
	seed({ 'sdd-plugins': [{ name: 'aces' }] })
	const r = run('config', 'get', '--key', 'sdd-plugins', '--bogus')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--bogus|bogus/)
})

test('config get --help exits zero with a synopsis and example', () => {
	const r = spawnSync('node', [bin, 'config', 'get', '--help'], { encoding: 'utf8' })
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/--key/)
	expect(r.stdout).toMatch(/Example/)
})
