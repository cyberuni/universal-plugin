import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildPlugin, readManifest, validateManifest } from './build.js'

let dir: string
let home: string

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-test-'))
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-home-'))
	process.env['HOME'] = home
})

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
	fs.rmSync(home, { recursive: true, force: true })
})

function writeManifest(manifest: object, indent?: string | number) {
	fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, indent))
}

/** Wraps universal-plugin build config in the canonical Agent Plugins Spec extensions namespace. */
function up(config: Record<string, unknown>): Record<string, Record<string, unknown>> {
	return { 'org.cyberuni.universal-plugin': config }
}

function writeSkill(name: string, content: string) {
	const skillDir = path.join(dir, 'skills', name)
	fs.mkdirSync(skillDir, { recursive: true })
	fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content)
}

describe('readManifest', () => {
	it('throws when plugin.json is missing', () => {
		const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-empty-'))
		try {
			expect(() => readManifest(empty)).toThrow('No plugin.json')
		} finally {
			fs.rmSync(empty, { recursive: true, force: true })
		}
	})

	it('parses a valid manifest', () => {
		writeManifest({ name: 'my-plugin' })
		expect(readManifest(dir).name).toBe('my-plugin')
	})
})

describe('buildPlugin', () => {
	it('throws the friendly error when plugin.json is missing', () => {
		const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-empty-'))
		try {
			// Guards the CLI code path (buildPlugin), not just readManifest — the raw indent
			// read must not shadow the friendly "No plugin.json found" message.
			expect(() => buildPlugin(empty)).toThrow('No plugin.json found')
		} finally {
			fs.rmSync(empty, { recursive: true, force: true })
		}
	})
})

describe('validateManifest', () => {
	it('returns error when name is missing', () => {
		const errors = validateManifest({ name: '' })
		expect(errors).toContain('name is required')
	})

	it('returns error when codex vendor lacks description', () => {
		const errors = validateManifest({ name: 'x', version: '1.0.0', extensions: up({ harnesses: { codex: {} } }) })
		expect(errors).toContain('description is required when targeting codex')
	})

	it('returns error when codex vendor lacks version', () => {
		const errors = validateManifest({ name: 'x', description: 'y', extensions: up({ harnesses: { codex: {} } }) })
		expect(errors).toContain('version is required when targeting codex')
	})

	it('returns no errors for valid manifest', () => {
		const errors = validateManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) })
		expect(errors).toHaveLength(0)
	})
})

describe('buildPlugin', () => {
	it('returns empty result with warning when harnesses is absent', () => {
		writeManifest({ name: 'my-plugin' })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.vendors).toHaveLength(0)
		expect(result.warnings[0]).toMatch(/nothing to build/)
	})

	it('lists vendors from harnesses keys', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'claude-code': {}, cursor: {} } }) })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.vendors).toEqual(['claude-code', 'cursor'])
	})

	it('warns and skips unknown vendors', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { unknown: {} } }) })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.warnings[0]).toMatch(/Unknown vendor/)
		expect(result.vendors).toHaveLength(0)
	})

	it('--vendor filters to a single vendor', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'claude-code': {}, cursor: {} } }) })
		const result = buildPlugin(dir, { dryRun: true, vendor: 'claude-code' })
		expect(result.vendors).toEqual(['claude-code'])
	})

	it('throws when --vendor is not in harnesses', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'claude-code': {} } }) })
		expect(() => buildPlugin(dir, { vendor: 'cursor' })).toThrow('not declared')
	})

	it('the vendors list selects the build targets when present', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ vendors: ['claude-code', 'cursor'], harnesses: { 'claude-code': {}, cursor: {}, codex: {} } }),
		})
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.vendors).toEqual(['claude-code', 'cursor'])
	})

	it('falls back to all harnesses keys when no vendors list is present', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'claude-code': {}, cursor: {} } }) })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.vendors).toEqual(['claude-code', 'cursor'])
	})

	// Copilot CLI checks .plugin/ → plugin.json → .github/plugin/ → .claude-plugin/ and takes the
	// first match, so root always shadows .github/plugin/. Deriving there produced a file Copilot
	// could never read; the canonical manifest serves Copilot directly instead.
	it('derives no manifest for copilot-cli — the canonical root plugin.json serves it', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'copilot-cli': {} } }) })
		const canonicalBefore = fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')
		const result = buildPlugin(dir)
		expect(fs.existsSync(path.join(dir, '.github', 'plugin', 'plugin.json'))).toBe(false)
		// The canonical root plugin.json is the source, never a build output — it must be left untouched.
		expect(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')).toBe(canonicalBefore)
		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: 'plugin.json', status: 'canonical' }])
		expect(result.written).toEqual([])
	})

	it('warns that copilot-cli harness overrides have no delivery path', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ harnesses: { 'copilot-cli': { category: 'dev', tags: ['a'] } } }),
		})
		const result = buildPlugin(dir)
		// The canonical schema is closed, so a Copilot-only field cannot ride along in root — say so
		// rather than dropping it silently.
		expect(result.warnings).toEqual([
			'harnesses.copilot-cli sets category, tags, but copilot-cli reads the canonical plugin.json directly — these fields are not delivered',
		])
	})

	it('writes vendor manifests with merged fields', () => {
		writeManifest({
			$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
			name: 'my-plugin',
			extensions: up({
				vendors: ['claude-code'],
				packagePath: './',
				skills: './skills/',
				harnesses: { 'claude-code': { displayName: 'My Plugin' } },
			}),
		})
		buildPlugin(dir)
		const written = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8'))
		expect(written.name).toBe('my-plugin')
		expect(written.skills).toBe('./skills/')
		expect(written.displayName).toBe('My Plugin')
		// The canonical wrapper + universal-plugin's orchestration keys never leak into a derived manifest.
		expect(written.harnesses).toBeUndefined()
		expect(written.vendors).toBeUndefined()
		expect(written.packagePath).toBeUndefined()
		expect(written.extensions).toBeUndefined()
		expect(written.$schema).toBeUndefined()
	})

	it('uses tab indentation by default when plugin.json has no indentation', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) })
		buildPlugin(dir)
		const raw = fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')
		expect(raw).toContain('\t')
	})

	it('vendor output follows tab indentation from plugin.json', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) }, '\t')
		buildPlugin(dir)
		const raw = fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')
		expect(raw).toContain('\t')
		expect(raw).not.toMatch(/\n {2}/)
	})

	it('vendor output follows 2-space indentation from plugin.json', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) }, 2)
		buildPlugin(dir)
		const raw = fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')
		expect(raw).toContain('\n  ')
		expect(raw).not.toContain('\t')
	})

	it('derives no Cursor command — Cursor loads SKILL.md from the manifest skills path', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { cursor: {} } }) })
		writeSkill('deploy', '---\ninvocation-policy: user\ndescription: Deploy safely\n---\nDeploy $ARGUMENTS.')

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, '.cursor'))).toBe(false)
	})

	it('derives a best-effort Codex prompt from a both-invocable skill', () => {
		writeManifest({ name: 'x', version: '1.0.0', description: 'x', extensions: up({ harnesses: { codex: {} } }) })
		writeSkill('review', '---\ninvocation-policy: both\n---\nReview the current diff.')

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(home, '.codex', 'prompts', 'review.md'), 'utf8')).toBe('Review the current diff.')
	})

	it('does not derive a Codex prompt from a model-only skill', () => {
		writeManifest({ name: 'x', version: '1.0.0', description: 'x', extensions: up({ harnesses: { codex: {} } }) })
		writeSkill('context', '---\ninvocation-policy: model\n---\nBackground context.')

		buildPlugin(dir)

		expect(fs.existsSync(path.join(home, '.codex', 'prompts', 'context.md'))).toBe(false)
	})

	it('maps canonical invocation policies to Claude frontmatter', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) })
		writeSkill('deploy', '---\ninvocation-policy: user\nuser-invocable: false\n---\nDeploy.')
		writeSkill('context', '---\ninvocation-policy: model\ndisable-model-invocation: true\n---\nContext.')

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(dir, 'skills', 'deploy', 'SKILL.md'), 'utf8')).toContain(
			'disable-model-invocation: true',
		)
		expect(fs.readFileSync(path.join(dir, 'skills', 'deploy', 'SKILL.md'), 'utf8')).not.toContain(
			'user-invocable: false',
		)
		expect(fs.readFileSync(path.join(dir, 'skills', 'context', 'SKILL.md'), 'utf8')).toContain('user-invocable: false')
		expect(fs.readFileSync(path.join(dir, 'skills', 'context', 'SKILL.md'), 'utf8')).not.toContain(
			'disable-model-invocation: true',
		)
	})

	it('rejects an unsupported invocation policy', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { cursor: {} } }) })
		writeSkill('invalid', '---\ninvocation-policy: never\n---\nNope.')

		expect(() => buildPlugin(dir)).toThrow('expected user, model, or both')
	})
})

describe('buildPlugin — hooks (ADR-0011)', () => {
	function writeHooks(relPath: string, hooks: object) {
		const target = path.join(dir, relPath)
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.writeFileSync(target, JSON.stringify({ hooks }, null, '\t'))
	}

	function readJson(relPath: string) {
		return JSON.parse(fs.readFileSync(path.join(dir, relPath), 'utf8'))
	}

	const commandRule = { hooks: [{ type: 'command', command: './scripts/start.sh' }] }

	it('leaves the canonical hooks declaration alone for claude-code', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [commandRule] })
		writeManifest({
			name: 'my-plugin',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { 'claude-code': {} } }),
		})
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').hooks).toBe('./hooks/hooks.json')
		expect(fs.existsSync(path.join(dir, '.claude-plugin', 'hooks.json'))).toBe(false)
		expect(result.warnings).toEqual([])
	})

	it('derives a camelCase hooks file for cursor and points the manifest at it', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [commandRule] })
		writeManifest({ name: 'my-plugin', extensions: up({ hooks: './hooks/hooks.json', harnesses: { cursor: {} } }) })
		const result = buildPlugin(dir)

		const derived = readJson('.cursor-plugin/hooks.json')
		expect(derived).toEqual({
			version: 1,
			hooks: { sessionStart: [{ type: 'command', command: './scripts/start.sh' }] },
		})
		expect(readJson('.cursor-plugin/plugin.json').hooks).toBe('./.cursor-plugin/hooks.json')
		expect(result.written).toContain(path.join(dir, '.cursor-plugin', 'hooks.json'))
		// The authored file is an input, never an output.
		expect(readJson('hooks/hooks.json')).toEqual({ hooks: { SessionStart: [commandRule] } })
	})

	it('repeats a matcher on each handler when it flattens a group for cursor', () => {
		writeHooks('hooks/hooks.json', {
			PreToolUse: [
				{
					matcher: 'Write|Edit',
					hooks: [
						{ type: 'command', command: './a.sh' },
						{ type: 'command', command: './b.sh' },
					],
				},
			],
		})
		writeManifest({ name: 'my-plugin', extensions: up({ hooks: './hooks/hooks.json', harnesses: { cursor: {} } }) })
		buildPlugin(dir)
		expect(readJson('.cursor-plugin/hooks.json').hooks.preToolUse).toEqual([
			{ type: 'command', command: './a.sh', matcher: 'Write|Edit' },
			{ type: 'command', command: './b.sh', matcher: 'Write|Edit' },
		])
	})

	it('drops a handler codex cannot run, warns, and keeps the rest', () => {
		writeHooks('hooks/hooks.json', {
			SessionStart: [
				{
					hooks: [
						{ type: 'command', command: './a.sh' },
						{ type: 'prompt', prompt: 'check' },
					],
				},
			],
		})
		writeManifest({
			name: 'my-plugin',
			version: '1.0.0',
			description: 'x',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { codex: {} } }),
		})
		const result = buildPlugin(dir)

		expect(result.warnings).toEqual([
			'codex cannot run the "prompt" hook handler on SessionStart — dropped from the derived hooks file',
		])
		expect(readJson('.codex-plugin/hooks.json').hooks.SessionStart).toEqual([
			{ hooks: [{ type: 'command', command: './a.sh' }] },
		])
		expect(readJson('.codex-plugin/plugin.json').hooks).toBe('./.codex-plugin/hooks.json')
		expect(result.rows).toEqual([{ vendor: 'codex', path: '.codex-plugin/plugin.json', status: 'built' }])
	})

	it('warns once per event and handler type, not once per handler', () => {
		writeHooks('hooks/hooks.json', {
			SessionStart: [
				{
					hooks: [
						{ type: 'prompt', prompt: 'one' },
						{ type: 'prompt', prompt: 'two' },
					],
				},
			],
		})
		writeManifest({
			name: 'my-plugin',
			version: '1.0.0',
			description: 'x',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { codex: {} } }),
		})
		expect(buildPlugin(dir).warnings).toHaveLength(1)
	})

	it('writes no hooks file and omits the hooks field when nothing survives', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [{ hooks: [{ type: 'http', url: 'https://example.test/h' }] }] })
		writeManifest({
			name: 'my-plugin',
			version: '1.0.0',
			description: 'x',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { codex: {} } }),
		})
		const result = buildPlugin(dir)
		expect(fs.existsSync(path.join(dir, '.codex-plugin', 'hooks.json'))).toBe(false)
		expect(readJson('.codex-plugin/plugin.json').hooks).toBeUndefined()
		expect(result.warnings[0]).toMatch(/codex cannot run the "http" hook handler/)
	})

	it('removes a derived hooks file left by an earlier build when nothing survives', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [commandRule] })
		writeManifest({
			name: 'my-plugin',
			version: '1.0.0',
			description: 'x',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { codex: {} } }),
		})
		buildPlugin(dir)
		writeHooks('hooks/hooks.json', { SessionStart: [{ hooks: [{ type: 'agent', prompt: 'verify' }] }] })
		buildPlugin(dir)
		expect(fs.existsSync(path.join(dir, '.codex-plugin', 'hooks.json'))).toBe(false)
	})

	// Copilot CLI reads the canonical manifest and its hooks file directly, so there is no derived
	// file to deliver — the warning is the whole remedy available.
	it('warns that copilot-cli ignores an unsupported handler at runtime, and derives nothing', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [{ hooks: [{ type: 'agent', prompt: 'verify' }] }] })
		writeManifest({
			name: 'my-plugin',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { 'copilot-cli': {} } }),
		})
		const result = buildPlugin(dir)
		expect(result.warnings).toEqual([
			'copilot-cli cannot run the "agent" hook handler on SessionStart — it is ignored at runtime',
		])
		expect(result.written).toEqual([])
	})

	it('translates hooks declared inline in the manifest', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ hooks: { hooks: { SessionStart: [commandRule] } }, harnesses: { cursor: {} } }),
		})
		buildPlugin(dir)
		expect(readJson('.cursor-plugin/hooks.json').hooks.sessionStart).toHaveLength(1)
		expect(readJson('.cursor-plugin/plugin.json').hooks).toBe('./.cursor-plugin/hooks.json')
	})

	it('merges a declared list of hooks paths into one derived file', () => {
		writeHooks('hooks/session.json', { SessionStart: [commandRule] })
		writeHooks('hooks/tools.json', { PreToolUse: [commandRule] })
		writeManifest({
			name: 'my-plugin',
			extensions: up({ hooks: { paths: ['./hooks/session.json', './hooks/tools.json'] }, harnesses: { cursor: {} } }),
		})
		buildPlugin(dir)
		expect(Object.keys(readJson('.cursor-plugin/hooks.json').hooks)).toEqual(['sessionStart', 'preToolUse'])
	})

	// The default location is what every vendor auto-discovers, so a plugin that never declares
	// `hooks` still ships them — and Cursor still needs the translated form.
	it('translates the default hooks path when the manifest declares none', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [commandRule] })
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { cursor: {} } }) })
		buildPlugin(dir)
		expect(readJson('.cursor-plugin/hooks.json').hooks.sessionStart).toHaveLength(1)
		expect(readJson('.cursor-plugin/plugin.json').hooks).toBe('./.cursor-plugin/hooks.json')
	})

	it('derives no hooks file under --dry-run', () => {
		writeHooks('hooks/hooks.json', { SessionStart: [commandRule] })
		writeManifest({ name: 'my-plugin', extensions: up({ hooks: './hooks/hooks.json', harnesses: { cursor: {} } }) })
		buildPlugin(dir, { dryRun: true })
		expect(fs.existsSync(path.join(dir, '.cursor-plugin', 'hooks.json'))).toBe(false)
	})

	it('warns and passes the declaration through when the hooks file is missing', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ hooks: './hooks/hooks.json', harnesses: { cursor: {} } }) })
		const result = buildPlugin(dir)
		expect(result.warnings[0]).toMatch(/hooks file "\.\/hooks\/hooks\.json" not found/)
		expect(readJson('.cursor-plugin/plugin.json').hooks).toBe('./hooks/hooks.json')
	})

	it('warns and passes the declaration through when the hooks file is unreadable JSON', () => {
		fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true })
		fs.writeFileSync(path.join(dir, 'hooks', 'hooks.json'), '{ not json')
		writeManifest({ name: 'my-plugin', extensions: up({ hooks: './hooks/hooks.json', harnesses: { cursor: {} } }) })
		const result = buildPlugin(dir)
		expect(result.warnings[0]).toMatch(/could not be read/)
		expect(readJson('.cursor-plugin/plugin.json').hooks).toBe('./hooks/hooks.json')
	})
})

describe('buildPlugin — dependencies', () => {
	function readJson(relPath: string) {
		return JSON.parse(fs.readFileSync(path.join(dir, relPath), 'utf8'))
	}

	it('delivers the declaration to the claude-code manifest as a top-level field', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ dependencies: ['cyber-asana'], harnesses: { 'claude-code': {} } }),
		})
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').dependencies).toEqual(['cyber-asana'])
		expect(result.warnings).toEqual([])
	})

	it('delivers the object form unchanged, constraint and all', () => {
		const declared = [{ name: 'cyber-asana', marketplace: 'cyberuni', version: '^0.9.0' }]
		writeManifest({ name: 'my-plugin', extensions: up({ dependencies: declared, harnesses: { 'claude-code': {} } }) })
		buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').dependencies).toEqual(declared)
	})

	it('drops the declaration from the cursor manifest and warns', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ dependencies: ['cyber-asana'], harnesses: { cursor: {} } }) })
		const result = buildPlugin(dir)
		expect(readJson('.cursor-plugin/plugin.json').dependencies).toBeUndefined()
		expect(result.warnings).toEqual([
			'cursor does not read plugin dependencies — "cyber-asana" is dropped from the derived manifest',
		])
	})

	it('drops the declaration from the codex manifest and warns', () => {
		writeManifest({
			name: 'my-plugin',
			version: '1.0.0',
			description: 'd',
			extensions: up({ dependencies: ['cyber-asana'], harnesses: { codex: {} } }),
		})
		const result = buildPlugin(dir)
		expect(readJson('.codex-plugin/plugin.json').dependencies).toBeUndefined()
		expect(result.warnings).toEqual([
			'codex does not read plugin dependencies — "cyber-asana" is dropped from the derived manifest',
		])
	})

	it('warns that copilot-cli ignores the declaration it reads in the canonical manifest', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ dependencies: ['cyber-asana'], harnesses: { 'copilot-cli': {} } }),
		})
		const result = buildPlugin(dir)
		expect(result.warnings).toEqual([
			'copilot-cli does not read plugin dependencies — "cyber-asana" is ignored at runtime',
		])
	})

	it('stays green: every vendor is still built when a declaration cannot be delivered', () => {
		writeManifest({
			name: 'my-plugin',
			version: '1.0.0',
			description: 'd',
			extensions: up({ dependencies: ['cyber-asana'], harnesses: { 'claude-code': {}, cursor: {}, codex: {} } }),
		})
		const result = buildPlugin(dir)
		expect(result.summary).toMatchObject({ built: 3, failed: 0 })
		expect(result.warnings).toHaveLength(2)
	})

	it('warns once, not per vendor, about a range the runtime discards', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ dependencies: ['cyber-asana@^0.9.0'], harnesses: { 'claude-code': {}, cursor: {} } }),
		})
		const result = buildPlugin(dir)
		expect(result.warnings.filter((w) => w.includes('discards'))).toHaveLength(1)
	})

	it('fails the build on a declaration the runtime would reject', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ dependencies: { 'cyber-asana': '^0.9.0' }, harnesses: { 'claude-code': {} } }),
		})
		expect(() => buildPlugin(dir)).toThrow('dependencies must be an array')
	})

	it('leaves a manifest without a declaration without the field', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'claude-code': {} } }) })
		buildPlugin(dir)
		expect('dependencies' in readJson('.claude-plugin/plugin.json')).toBe(false)
	})

	it('lets a harnesses override still set dependencies for the vendor that reads them', () => {
		writeManifest({
			name: 'my-plugin',
			extensions: up({ harnesses: { 'claude-code': { dependencies: ['hand-written'] } } }),
		})
		buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').dependencies).toEqual(['hand-written'])
	})
})

/** A build keeps the repository's marketplace catalogs true: the entry for the plugin being built is
 *  re-derived from the canonical manifest, so its version follows a bump instead of drifting
 *  (ADR-0010 §3). Only catalogs the repository already carries are touched — creating one is
 *  `plugin init --vendor` / `marketplace init`. */
describe('buildPlugin — repository-local catalogs', () => {
	let repoRoot: string
	let pluginRoot: string

	beforeEach(() => {
		repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-catalog-repo-'))
		execFileSync('git', ['-C', repoRoot, 'init', '-q'])
		pluginRoot = path.join(repoRoot, 'packages', 'my-plugin')
		fs.mkdirSync(pluginRoot, { recursive: true })
	})

	afterEach(() => fs.rmSync(repoRoot, { recursive: true, force: true }))

	function writePluginManifest(version: string) {
		fs.writeFileSync(
			path.join(pluginRoot, 'plugin.json'),
			JSON.stringify({
				name: 'my-plugin',
				version,
				description: 'A plugin',
				extensions: up({ harnesses: { codex: {}, 'claude-code': {} } }),
			}),
		)
	}

	function writeCatalog(relative: string, content: unknown) {
		const file = path.join(repoRoot, relative)
		fs.mkdirSync(path.dirname(file), { recursive: true })
		fs.writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`)
	}

	function readCatalog(relative: string): Record<string, unknown> {
		return JSON.parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'))
	}

	function entries(relative: string): Record<string, unknown>[] {
		return readCatalog(relative).plugins as Record<string, unknown>[]
	}

	it('re-derives this plugin entry version, keeping the rest of the catalog', () => {
		writeCatalog('.agents/plugins/marketplace.json', {
			name: 'pan-repo-local',
			interface: { displayName: 'pan-repo-local' },
			plugins: [
				{ name: 'other', version: '3.0.0', source: { source: 'local', path: './packages/other' } },
				{
					name: 'my-plugin',
					version: '0.9.0',
					source: { source: 'local', path: './packages/my-plugin' },
					category: 'Productivity',
				},
			],
		})
		writePluginManifest('1.2.0')

		const result = buildPlugin(pluginRoot, {})
		const catalog = readCatalog('.agents/plugins/marketplace.json')
		expect(catalog.name).toBe('pan-repo-local')
		expect(entries('.agents/plugins/marketplace.json')[0]).toMatchObject({ name: 'other', version: '3.0.0' })
		expect(entries('.agents/plugins/marketplace.json')[1]).toMatchObject({
			name: 'my-plugin',
			version: '1.2.0',
			source: { source: 'local', path: './packages/my-plugin' },
			category: 'Productivity',
		})
		expect(result.catalogs).toEqual([{ path: '.agents/plugins/marketplace.json', status: 'updated' }])
		expect(result.written).toContain(path.join(repoRoot, '.agents', 'plugins', 'marketplace.json'))
	})

	it('reports an already-current catalog as unchanged and rewrites nothing', () => {
		writeCatalog('.agents/plugins/marketplace.json', {
			name: 'pan-repo-local',
			plugins: [{ name: 'my-plugin', version: '1.2.0', source: { source: 'local', path: './packages/my-plugin' } }],
		})
		writePluginManifest('1.2.0')
		buildPlugin(pluginRoot, {})
		const before = fs.readFileSync(path.join(repoRoot, '.agents', 'plugins', 'marketplace.json'), 'utf8')

		const result = buildPlugin(pluginRoot, {})
		expect(result.catalogs).toEqual([{ path: '.agents/plugins/marketplace.json', status: 'unchanged' }])
		expect(fs.readFileSync(path.join(repoRoot, '.agents', 'plugins', 'marketplace.json'), 'utf8')).toBe(before)
	})

	it('creates no catalog the repository does not already carry', () => {
		writePluginManifest('1.2.0')
		const result = buildPlugin(pluginRoot, {})
		expect(result.catalogs).toEqual([])
		expect(fs.existsSync(path.join(repoRoot, '.agents', 'plugins', 'marketplace.json'))).toBe(false)
	})

	it('refreshes only the vendors being built, and writes nothing on --dry-run', () => {
		writeCatalog('.agents/plugins/marketplace.json', {
			name: 'pan-repo-local',
			plugins: [{ name: 'my-plugin', version: '0.9.0', source: { source: 'local', path: './packages/my-plugin' } }],
		})
		writeCatalog('.claude-plugin/marketplace.json', {
			name: 'pan-repo-local',
			owner: { name: 'pan' },
			plugins: [{ name: 'my-plugin', source: './packages/my-plugin', version: '0.9.0' }],
		})
		writePluginManifest('1.2.0')

		const dry = buildPlugin(pluginRoot, { dryRun: true })
		expect(dry.catalogs.map((row) => row.status)).toEqual(['planned', 'planned'])
		expect(entries('.agents/plugins/marketplace.json')[0]).toMatchObject({ version: '0.9.0' })

		buildPlugin(pluginRoot, { vendor: 'codex' })
		expect(entries('.agents/plugins/marketplace.json')[0]).toMatchObject({ version: '1.2.0' })
		expect(entries('.claude-plugin/marketplace.json')[0]).toMatchObject({ version: '0.9.0' })
	})
})

/** The repository formats its JSON with its own tools, so a refresh compares meaning rather than
 *  bytes and writes with the indentation the catalog already uses. Otherwise every build would
 *  rewrite a file whose content it agrees with. */
describe('buildPlugin — catalog formatting', () => {
	let repoRoot: string
	let pluginRoot: string

	beforeEach(() => {
		repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-catalog-fmt-'))
		execFileSync('git', ['-C', repoRoot, 'init', '-q'])
		pluginRoot = path.join(repoRoot, 'packages', 'my-plugin')
		fs.mkdirSync(pluginRoot, { recursive: true })
		fs.writeFileSync(
			path.join(pluginRoot, 'plugin.json'),
			JSON.stringify({
				name: 'my-plugin',
				version: '1.2.0',
				description: 'A plugin',
				keywords: ['a', 'b'],
				extensions: up({ harnesses: { 'claude-code': {} } }),
			}),
		)
	})

	afterEach(() => fs.rmSync(repoRoot, { recursive: true, force: true }))

	const catalogFile = () => path.join(repoRoot, '.claude-plugin', 'marketplace.json')

	function writeCatalog(content: string) {
		fs.mkdirSync(path.dirname(catalogFile()), { recursive: true })
		fs.writeFileSync(catalogFile(), content)
	}

	it('leaves a catalog whose content already agrees, whatever its formatting', () => {
		writeCatalog(
			'{"name":"pan-repo-local","owner":{"name":"pan"},"plugins":[{"name":"my-plugin",' +
				'"source":"./packages/my-plugin","description":"A plugin","version":"1.2.0","keywords":["a","b"]}]}\n',
		)
		const before = fs.readFileSync(catalogFile(), 'utf8')
		const result = buildPlugin(pluginRoot, {})
		expect(result.catalogs).toEqual([{ path: '.claude-plugin/marketplace.json', status: 'unchanged' }])
		expect(fs.readFileSync(catalogFile(), 'utf8')).toBe(before)
	})

	it('writes with the indentation the catalog already uses, and keeps its key order', () => {
		writeCatalog(
			`${JSON.stringify(
				{
					name: 'pan-repo-local',
					owner: { name: 'pan' },
					description: 'the repository catalog',
					plugins: [{ name: 'my-plugin', source: './packages/my-plugin' }],
				},
				null,
				'\t',
			)}\n`,
		)
		buildPlugin(pluginRoot, {})
		const written = fs.readFileSync(catalogFile(), 'utf8')
		expect(written).toContain('\n\t"name"')
		expect(written).not.toContain('\n  "name"')
		expect(Object.keys(JSON.parse(written))).toEqual(['name', 'owner', 'description', 'plugins'])
	})
})
