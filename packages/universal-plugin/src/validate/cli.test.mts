import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')
const SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'

let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-validate-'))
})
afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true })
})

function writeManifest(manifest: object) {
	fs.writeFileSync(path.join(root, 'plugin.json'), `${JSON.stringify(manifest, null, '\t')}\n`)
}

function valid(harnesses: Record<string, object> = { 'claude-code': {} }, extra: object = {}) {
	return {
		$schema: SCHEMA_URL,
		name: 'pods',
		version: '1.0.0',
		description: 'a plugin',
		extensions: { 'org.cyberuni.universal-plugin': { harnesses } },
		...extra,
	}
}

function run(...args: string[]) {
	return spawnSync('node', [bin, ...args], {
		cwd: root,
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

const validate = (...args: string[]) => run('plugin', 'validate', ...args)
const lastLine = (text: string) => text.trimEnd().split('\n').at(-1)

// Scenario: valid manifest exits 0 with a definitive clean result
test('a valid manifest exits 0 with valid: true and empty violation lists', () => {
	writeManifest(valid())
	const r = validate()
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/^valid: true$/m)
	expect(r.stdout).toMatch(/^schemaViolations: \[\]$/m)
	expect(r.stdout).toMatch(/^vendorViolations: \[\]$/m)
})

// Scenario: missing plugin.json fails
test('a missing plugin.json exits 1 naming it', () => {
	const r = validate()
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('No plugin.json found')
})

// Scenario: schema violation is reported in the default TOON result
test('a missing name is a schema violation row', () => {
	const { name: _name, ...manifest } = valid()
	writeManifest(manifest)
	const r = validate()
	expect(r.status).toBe(1)
	expect(r.stdout).toMatch(/^valid: false$/m)
	expect(r.stdout).toMatch(/^ {2}name,required,required field missing$/m)
})

// Scenario: all violations are reported together
test('every schema violation is reported in one pass', () => {
	const { name: _name, $schema: _schema, ...manifest } = valid()
	writeManifest(manifest)
	const r = validate()
	expect(r.status).toBe(1)
	expect(r.stdout).toMatch(/^ {2}\$schema,required/m)
	expect(r.stdout).toMatch(/^ {2}name,required/m)
	expect(r.stdout).toContain('2 schema violations, 0 vendor violations')
})

// Scenario: version is not a schema requirement
test('a manifest without version is valid when codex is not a target', () => {
	const { version: _v, ...manifest } = valid()
	writeManifest(manifest)
	const r = validate()
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/^valid: true$/m)
})

// Scenario: a top-level key the standard does not define is a schema violation
test('a top-level vendorExtensions block is a schema violation', () => {
	writeManifest(valid({}, { vendorExtensions: { 'claude-code': {} } }))
	const r = validate()
	expect(r.status).toBe(1)
	expect(r.stdout).toMatch(/^ {2}vendorExtensions,additionalProperties/m)
})

// Scenario: vendor rule violation is reported
test('codex requires description and version', () => {
	const { description: _d, version: _v, ...manifest } = valid({ codex: {} })
	writeManifest(manifest)
	const r = validate()
	expect(r.status).toBe(1)
	expect(r.stdout).toContain('description is required when targeting codex')
	expect(r.stdout).toContain('version is required when targeting codex')
})

// Scenario: --vendor limits vendor rule checks to one vendor
test('--vendor scopes the vendor rules', () => {
	const { description: _d, version: _v, ...manifest } = valid({ codex: {}, cursor: {} })
	writeManifest(manifest)
	const r = validate('--vendor', 'cursor')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/^valid: true$/m)
})

// Scenario: --vendor unknown value fails
test('an unknown --vendor fails', () => {
	writeManifest(valid())
	const r = validate('--vendor', 'acme')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('Unknown vendor')
})

// Scenario: unknown harnesses key emits warning but exits 0 without --strict
test('an unknown harnesses key warns and stays valid', () => {
	writeManifest(valid({ acme: {} }))
	const r = validate()
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/^valid: true$/m)
	expect(r.stderr).toContain('Unknown vendor')
})

// Scenario: --strict promotes warnings to errors
test('--strict makes an unknown harnesses key a violation', () => {
	writeManifest(valid({ acme: {} }))
	const r = validate('--strict')
	expect(r.status).toBe(1)
	expect(r.stdout).toMatch(/^valid: false$/m)
	expect(r.stdout).toMatch(/^ {2}harnesses\.acme,known-vendor/m)
	expect(r.stderr).toContain('Unknown vendor')
})

// Scenario: --format json returns structured output
test('--format json reports violations as structured output', () => {
	const { name: _name, ...manifest } = valid()
	writeManifest(manifest)
	const r = validate('--format', 'json')
	expect(r.status).toBe(1)
	const json = JSON.parse(r.stdout)
	expect(json.valid).toBe(false)
	expect(json.schemaViolations.length).toBeGreaterThan(0)
})

// Scenario: --format json valid manifest
test('--format json reports a valid manifest', () => {
	writeManifest(valid())
	const r = validate('--format', 'json')
	expect(r.status).toBe(0)
	expect(JSON.parse(r.stdout)).toEqual({ valid: true, schemaViolations: [], vendorViolations: [] })
})

function fiftyViolations() {
	writeManifest(valid({}, Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`unknown${i}`, true]))))
}

// Scenario: default output truncates a large violation list
test('the default output truncates a large violation list', () => {
	fiftyViolations()
	const r = validate()
	expect(r.status).toBe(1)
	expect(r.stdout.match(/additionalProperties/g)).toHaveLength(20)
	expect(lastLine(r.stdout)).toMatch(/… \+30 more — rerun with --full/)
})

// Scenario: --format json is never truncated
test('--format json is never truncated', () => {
	fiftyViolations()
	expect(JSON.parse(validate('--format', 'json').stdout).schemaViolations).toHaveLength(50)
})

// Scenario: --full suppresses truncation
test('--full lists every violation', () => {
	fiftyViolations()
	const r = validate('--full')
	expect(r.stdout.match(/additionalProperties/g)).toHaveLength(50)
	expect(r.stdout).not.toContain('rerun with --full')
})

// Scenario: passing validate suggests the next command
test('a passing run ends stderr with the build hint', () => {
	writeManifest(valid())
	expect(lastLine(validate().stderr)).toBe('→ universal-plugin plugin build')
})

// Scenario: failing validate suggests a fix
test('a failing run ends stderr with a fix hint naming the field', () => {
	const { name: _name, ...manifest } = valid()
	writeManifest(manifest)
	expect(lastLine(validate().stderr)).toMatch(/^→ fix name\b/)
})

// Scenario: bare "plugin" command runs validate on the current project
test('bare plugin validates the project and reports its harnesses', () => {
	writeManifest(valid({ 'claude-code': {}, cursor: {} }))
	const r = run('plugin')
	expect(r.status).toBe(0)
	expect(r.stdout).toMatch(/^valid: true$/m)
	expect(r.stdout).toMatch(/^harnesses\[2\]: claude-code,cursor$/m)
})

// The group's own --root must not swallow a subcommand's.
test('a subcommand keeps its own --root under the plugin group', () => {
	writeManifest(valid())
	const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-validate-cwd-'))
	try {
		const r = spawnSync('node', [bin, 'plugin', 'validate', '--root', root], { cwd: elsewhere, encoding: 'utf8' })
		expect(r.status).toBe(0)
		expect(r.stdout).toMatch(/^valid: true$/m)
	} finally {
		fs.rmSync(elsewhere, { recursive: true, force: true })
	}
})

// Scenario: unknown flag fails loud
test('an unknown flag fails naming it', () => {
	writeManifest(valid())
	const r = validate('--frobnicate')
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('--frobnicate')
})

// Scenario: --help prints a concise reference
test('--help prints the synopsis, flags, and an example', () => {
	const r = validate('--help')
	expect(r.status).toBe(0)
	expect(r.stdout).toContain('Usage: universal-plugin plugin validate')
	expect(r.stdout).toContain('--strict')
	expect(r.stdout).toContain('Example:')
})
