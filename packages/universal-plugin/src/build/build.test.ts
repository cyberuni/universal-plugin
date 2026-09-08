import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildPlugin, legacyLayoutSignals, readManifest, validateManifest } from './build.js'

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

	// Scenario: a pre-0.6 vendorExtensions block that derives nothing fails loud
	it('fails loud when a pre-0.6 vendorExtensions block explains the empty result', () => {
		writeManifest({ name: 'my-plugin', vendorExtensions: { 'claude-code': {} } })
		expect(() => buildPlugin(dir, { dryRun: true })).toThrow(/vendorExtensions/)
		expect(() => buildPlugin(dir, { dryRun: true })).toThrow(/\/universal-plugin:doctor/)
	})

	// Scenario: a shadowing .plugin/plugin.json that derives nothing fails loud
	it('fails loud when a shadowing .plugin/plugin.json explains the empty result', () => {
		writeManifest({ name: 'my-plugin' })
		fs.mkdirSync(path.join(dir, '.plugin'), { recursive: true })
		fs.writeFileSync(path.join(dir, '.plugin/plugin.json'), '{"name":"my-plugin"}')
		expect(() => buildPlugin(dir, { dryRun: true })).toThrow(/\.plugin\/plugin\.json/)
		expect(() => buildPlugin(dir, { dryRun: true })).toThrow(/\/universal-plugin:doctor/)
	})

	// Scenario: a pre-0.6 signal beside harnesses that still derive is not a build failure
	it('builds normally when a pre-0.6 signal sits beside harnesses that still derive', () => {
		writeManifest({ name: 'my-plugin', extensions: up({ harnesses: { 'claude-code': {} } }) })
		fs.mkdirSync(path.join(dir, '.plugin'), { recursive: true })
		fs.writeFileSync(path.join(dir, '.plugin/plugin.json'), '{"name":"my-plugin"}')
		const result = buildPlugin(dir)
		expect(result.vendors).toEqual(['claude-code'])
		expect(fs.existsSync(path.join(dir, '.claude-plugin/plugin.json'))).toBe(true)
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
	it('derives no manifest for copilot-cli, and no namespace tree when it declares no moved kind', () => {
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

describe('buildPlugin — component path resolution (the pathValue contract)', () => {
	/** Writes a skill under an arbitrary declared directory, not just the default ./skills/. */
	function writeSkillAt(dirRel: string, name: string, content: string) {
		const skillDir = path.join(dir, dirRel, name)
		fs.mkdirSync(skillDir, { recursive: true })
		fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content)
	}

	const userSkill = '---\ninvocation-policy: user\n---\nBody.'

	function derived(dirRel: string, name: string) {
		return fs.readFileSync(path.join(dir, dirRel, name, 'SKILL.md'), 'utf8')
	}

	it('resolves a skills path string', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} }, skills: './my-skills/' }) })
		writeSkillAt('my-skills', 'alpha', userSkill)

		buildPlugin(dir)

		expect(derived('my-skills', 'alpha')).toContain('disable-model-invocation: true')
	})

	it('resolves a skills path array across every declared directory', () => {
		writeManifest({
			name: 'x',
			extensions: up({ harnesses: { 'claude-code': {} }, skills: ['./a-skills/', './b-skills/'] }),
		})
		writeSkillAt('a-skills', 'alpha', userSkill)
		writeSkillAt('b-skills', 'beta', userSkill)

		buildPlugin(dir)

		expect(derived('a-skills', 'alpha')).toContain('disable-model-invocation: true')
		expect(derived('b-skills', 'beta')).toContain('disable-model-invocation: true')
	})

	it('resolves a skills paths object across every declared directory', () => {
		writeManifest({
			name: 'x',
			extensions: up({ harnesses: { 'claude-code': {} }, skills: { paths: ['./a-skills/', './b-skills/'] } }),
		})
		writeSkillAt('a-skills', 'alpha', userSkill)
		writeSkillAt('b-skills', 'beta', userSkill)

		buildPlugin(dir)

		expect(derived('a-skills', 'alpha')).toContain('disable-model-invocation: true')
		expect(derived('b-skills', 'beta')).toContain('disable-model-invocation: true')
	})

	it('never silently replaces a declared skills path with the default directory', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} }, skills: ['./a-skills/'] }) })
		writeSkillAt('a-skills', 'alpha', userSkill)
		writeSkillAt('skills', 'ignored', userSkill)

		buildPlugin(dir)

		expect(derived('a-skills', 'alpha')).toContain('disable-model-invocation: true')
		expect(derived('skills', 'ignored')).not.toContain('disable-model-invocation: true')
	})

	it('falls back to ./skills/ only when the namespace declares no skills path', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) })
		writeSkill('alpha', userSkill)

		buildPlugin(dir)

		expect(derived('skills', 'alpha')).toContain('disable-model-invocation: true')
	})

	it('warns about a declared skills directory that does not exist', () => {
		writeManifest({
			name: 'x',
			extensions: up({ harnesses: { 'claude-code': {} }, skills: ['./a-skills/', './missing/'] }),
		})
		writeSkillAt('a-skills', 'alpha', userSkill)

		const result = buildPlugin(dir)

		expect(result.warnings.some((w) => w.includes('./missing/'))).toBe(true)
		expect(derived('a-skills', 'alpha')).toContain('disable-model-invocation: true')
	})

	it('warns and reads nothing when the skills declaration is in none of the three forms', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} }, skills: 7 }) })
		writeSkill('alpha', userSkill)

		const result = buildPlugin(dir)

		expect(result.warnings.some((w) => w.includes('not a path, a path list, or a { paths } object'))).toBe(true)
		expect(derived('skills', 'alpha')).not.toContain('disable-model-invocation: true')
	})

	it('does not warn when the undeclared default skills directory is absent', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { 'claude-code': {} } }) })

		const result = buildPlugin(dir)

		expect(result.warnings.some((w) => w.includes('skills'))).toBe(false)
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

	// Copilot CLI's spec mode reads hooks/hooks.json under com.github.copilot/, so it does have a
	// derived file — the handler is dropped from it like any other vendor's (ADR-0015 revises
	// ADR-0011 §3).
	it('drops an unsupported handler from the copilot-cli namespace hooks file', () => {
		writeHooks('hooks/hooks.json', {
			SessionStart: [{ hooks: [{ type: 'agent', prompt: 'verify' }] }],
			Stop: [commandRule],
		})
		writeManifest({
			name: 'my-plugin',
			extensions: up({ hooks: './hooks/hooks.json', harnesses: { 'copilot-cli': {} } }),
		})
		const result = buildPlugin(dir)
		expect(result.warnings).toEqual([
			'copilot-cli cannot run the "agent" hook handler on SessionStart — dropped from the derived hooks file',
		])
		const derived = JSON.parse(fs.readFileSync(path.join(dir, 'com.github.copilot', 'hooks', 'hooks.json'), 'utf8'))
		expect(Object.keys(derived.hooks)).toEqual(['Stop'])
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

describe('legacyLayoutSignals', () => {
	it('reports nothing for a canonical manifest in a clean project root', () => {
		expect(legacyLayoutSignals({ name: 'my-plugin', extensions: up({ harnesses: {} }) }, false)).toEqual([])
	})

	// A manifest that merely omits the extensions block is deliberately not a pre-0.6 signal — it is
	// as likely to be one nobody has configured yet. doctor still reports it as `legacy-manifest`.
	it('does not treat a manifest without an extensions block as a pre-0.6 signal', () => {
		expect(legacyLayoutSignals({ name: 'my-plugin' }, false)).toEqual([])
	})

	it('reports both signals when both are present', () => {
		const signals = legacyLayoutSignals({ name: 'my-plugin', vendorExtensions: {} }, true)
		expect(signals).toHaveLength(2)
	})
})

describe('buildPlugin — mcpServers version pinning (#56)', () => {
	function readJson(relPath: string): Record<string, any> {
		return JSON.parse(fs.readFileSync(path.join(dir, relPath), 'utf8'))
	}

	const npxEntry = { command: 'npx', args: ['-y', 'cyber-asana', 'mcp'] }

	function withInline(servers: Record<string, unknown>, manifest: Record<string, unknown> = {}) {
		writeManifest({
			name: 'p',
			version: '0.10.0',
			...manifest,
			extensions: up({ mcpServers: servers, harnesses: { 'claude-code': {} } }),
		})
	}

	it('pins a marked entry to the manifest version', () => {
		withInline({ srv: { ...npxEntry, pinToPluginVersion: true } })
		buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['-y', 'cyber-asana@0.10.0', 'mcp'])
	})

	it('strips the marker from the derived manifest and leaves the canonical one alone', () => {
		withInline({ srv: { ...npxEntry, pinToPluginVersion: true } })
		const canonical = fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')
		buildPlugin(dir)
		expect(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).not.toContain('pinToPluginVersion')
		expect(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')).toBe(canonical)
	})

	it('leaves an unmarked entry alone — the marker is required, a name match is never used', () => {
		withInline({ srv: { ...npxEntry } })
		buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['-y', 'cyber-asana', 'mcp'])
	})

	it('does not stamp an unrelated invocation sitting beside a marked one', () => {
		withInline({
			srv: { ...npxEntry, pinToPluginVersion: true },
			other: { command: 'npx', args: ['-y', 'some-other-cli'] },
		})
		buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.other.args).toEqual(['-y', 'some-other-cli'])
	})

	it('keeps a scoped package name when pinning', () => {
		withInline({
			srv: { command: 'npx', args: ['--yes', '@cyberuni/server', 'mcp'], pinToPluginVersion: true },
		})
		buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual([
			'--yes',
			'@cyberuni/server@0.10.0',
			'mcp',
		])
	})

	it('overwrites an already-pinned specifier and warns about the version it replaced', () => {
		withInline({
			srv: { command: 'npx', args: ['-y', 'cyber-asana@0.9.0', 'mcp'], pinToPluginVersion: true },
		})
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['-y', 'cyber-asana@0.10.0', 'mcp'])
		expect(result.warnings.join('\n')).toContain('0.9.0')
	})

	it('rewrites a specifier already at the manifest version without warning', () => {
		withInline({
			srv: { command: 'npx', args: ['-y', 'cyber-asana@0.10.0', 'mcp'], pinToPluginVersion: true },
		})
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['-y', 'cyber-asana@0.10.0', 'mcp'])
		expect(result.warnings.join('\n')).not.toContain('overwritten')
	})

	it('warns and leaves the entry alone when the command is not a package runner', () => {
		withInline({ srv: { command: 'node', args: ['./server.js'], pinToPluginVersion: true } })
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['./server.js'])
		expect(result.warnings.join('\n')).toContain('srv')
	})

	it('warns and leaves the entry alone when the manifest carries no version', () => {
		writeManifest({
			name: 'p',
			extensions: up({
				mcpServers: { srv: { ...npxEntry, pinToPluginVersion: true } },
				harnesses: { 'claude-code': {} },
			}),
		})
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['-y', 'cyber-asana', 'mcp'])
		expect(result.warnings.join('\n')).toContain('no version')
	})

	it('warns and leaves the entry alone when args carry no package specifier', () => {
		withInline({ srv: { command: 'npx', args: ['-y'], pinToPluginVersion: true } })
		const result = buildPlugin(dir)
		expect(readJson('.claude-plugin/plugin.json').mcpServers.srv.args).toEqual(['-y'])
		expect(result.warnings.join('\n')).toContain('no package specifier')
	})

	it('derives an mcp file for a path declaration with a marked entry and repoints the manifest', () => {
		fs.writeFileSync(
			path.join(dir, 'mcp.json'),
			JSON.stringify({ mcpServers: { srv: { ...npxEntry, pinToPluginVersion: true } } }, null, '\t'),
		)
		const authored = fs.readFileSync(path.join(dir, 'mcp.json'), 'utf8')
		writeManifest({
			name: 'p',
			version: '0.10.0',
			extensions: up({ mcpServers: './mcp.json', harnesses: { 'claude-code': {} } }),
		})
		buildPlugin(dir)
		const derived = readJson('.claude-plugin/mcp.json')
		expect(derived.mcpServers.srv.args).toEqual(['-y', 'cyber-asana@0.10.0', 'mcp'])
		expect(derived.mcpServers.srv.pinToPluginVersion).toBeUndefined()
		expect(readJson('.claude-plugin/plugin.json').mcpServers).toBe('./.claude-plugin/mcp.json')
		expect(fs.readFileSync(path.join(dir, 'mcp.json'), 'utf8')).toBe(authored)
	})

	it('derives no mcp file when a path declaration marks nothing', () => {
		fs.writeFileSync(path.join(dir, 'mcp.json'), JSON.stringify({ mcpServers: { srv: npxEntry } }, null, '\t'))
		writeManifest({
			name: 'p',
			version: '0.10.0',
			extensions: up({ mcpServers: './mcp.json', harnesses: { 'claude-code': {} } }),
		})
		buildPlugin(dir)
		expect(fs.existsSync(path.join(dir, '.claude-plugin', 'mcp.json'))).toBe(false)
		expect(readJson('.claude-plugin/plugin.json').mcpServers).toBe('./mcp.json')
	})

	it('--dry-run derives no mcp file', () => {
		fs.writeFileSync(
			path.join(dir, 'mcp.json'),
			JSON.stringify({ mcpServers: { srv: { ...npxEntry, pinToPluginVersion: true } } }, null, '\t'),
		)
		writeManifest({
			name: 'p',
			version: '0.10.0',
			extensions: up({ mcpServers: './mcp.json', harnesses: { 'claude-code': {} } }),
		})
		buildPlugin(dir, { dryRun: true })
		expect(fs.existsSync(path.join(dir, '.claude-plugin', 'mcp.json'))).toBe(false)
	})

	it('warns that copilot-cli, which reads the canonical manifest, is not delivered the pin', () => {
		writeManifest({
			name: 'p',
			version: '0.10.0',
			description: 'd',
			extensions: up({
				mcpServers: { srv: { ...npxEntry, pinToPluginVersion: true } },
				harnesses: { 'copilot-cli': {} },
			}),
		})
		const canonical = fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')
		const result = buildPlugin(dir)
		expect(result.warnings.join('\n')).toContain('copilot-cli')
		expect(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')).toBe(canonical)
	})
})

describe('buildPlugin — the default mcp.json location', () => {
	it('reads the spec-fixed mcp.json when the manifest declares no mcpServers', () => {
		fs.writeFileSync(
			path.join(dir, 'mcp.json'),
			JSON.stringify({
				mcpServers: { srv: { command: 'npx', args: ['-y', 'cyber-asana', 'mcp'], pinToPluginVersion: true } },
			}),
		)
		writeManifest({ name: 'p', version: '0.10.0', extensions: up({ harnesses: { 'claude-code': {} } }) })
		buildPlugin(dir)
		const derived = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'mcp.json'), 'utf8'))
		expect(derived.mcpServers.srv.args).toEqual(['-y', 'cyber-asana@0.10.0', 'mcp'])
	})

	it('derives nothing when no mcp.json exists and none is declared', () => {
		writeManifest({ name: 'p', version: '0.10.0', extensions: up({ harnesses: { 'claude-code': {} } }) })
		buildPlugin(dir)
		expect(fs.existsSync(path.join(dir, '.claude-plugin', 'mcp.json'))).toBe(false)
		expect(
			JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).mcpServers,
		).toBeUndefined()
	})
})

describe('buildPlugin — mcpServers pinning under the upx runner', () => {
	it('pins a marked entry running upx', () => {
		writeManifest({
			name: 'p',
			version: '0.10.0',
			extensions: up({
				mcpServers: { srv: { command: 'upx', args: ['-y', 'cyber-asana', 'mcp'], pinToPluginVersion: true } },
				harnesses: { 'claude-code': {} },
			}),
		})
		buildPlugin(dir)
		const derived = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8'))
		expect(derived.mcpServers.srv.args).toEqual(['-y', 'cyber-asana@0.10.0', 'mcp'])
	})
})

describe('buildPlugin — locating the specifier with no runner flag', () => {
	it('pins the first argument when args carry no -y/--yes', () => {
		writeManifest({
			name: 'p',
			version: '0.10.0',
			extensions: up({
				mcpServers: { srv: { command: 'npx', args: ['cyber-asana', 'mcp'], pinToPluginVersion: true } },
				harnesses: { 'claude-code': {} },
			}),
		})
		buildPlugin(dir)
		const derived = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8'))
		expect(derived.mcpServers.srv.args).toEqual(['cyber-asana@0.10.0', 'mcp'])
	})
})

// Declaring the canonical $schema puts a plugin in Copilot CLI's spec mode, which reads agents,
// commands, rules, hooks/hooks.json and lsp.json ONLY under com.github.copilot/ and no longer from
// the plugin root (ADR-0015; `.research/copilot-spec-mode-namespace/`).
describe('buildPlugin — the copilot spec-mode namespace (ADR-0015)', () => {
	const NS = 'com.github.copilot'

	function writeComponent(relPath: string, content: string) {
		const target = path.join(dir, relPath)
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.writeFileSync(target, content)
	}

	function copilotManifest(config: Record<string, unknown>) {
		writeManifest({
			$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
			name: 'my-plugin',
			extensions: up({ ...config, harnesses: { 'copilot-cli': {} } }),
		})
	}

	it('copies declared agents, commands, and rules under the namespace', () => {
		writeComponent('agents/reviewer.agent.md', '---\nname: reviewer\n---\nreview it\n')
		writeComponent('commands/ship.md', '---\ndescription: ship\n---\nship it\n')
		writeComponent('rules/style.md', '---\ndescription: style\n---\ntabs\n')
		copilotManifest({ agents: './agents/', commands: './commands/', rules: './rules/' })

		buildPlugin(dir)

		for (const [source, copied] of [
			['agents/reviewer.agent.md', `${NS}/agents/reviewer.agent.md`],
			['commands/ship.md', `${NS}/commands/ship.md`],
			['rules/style.md', `${NS}/rules/style.md`],
		]) {
			expect(fs.readFileSync(path.join(dir, copied as string), 'utf8')).toBe(
				fs.readFileSync(path.join(dir, source as string), 'utf8'),
			)
		}
	})

	// Copilot CLI reads agents/ as .agent.md files; the canonical agents/ is the Claude Code-shaped
	// *.md, so a copy under the authored name lands a file the runtime ignores.
	it('renames a copied agent to the .agent.md convention', () => {
		writeComponent('agents/reviewer.md', 'agent\n')
		copilotManifest({ agents: './agents/' })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'reviewer.agent.md'))).toBe(true)
		expect(fs.existsSync(path.join(dir, NS, 'agents', 'reviewer.md'))).toBe(false)
	})

	it('leaves an agent already named .agent.md alone', () => {
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({ agents: './agents/' })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'reviewer.agent.md'))).toBe(true)
		expect(fs.existsSync(path.join(dir, NS, 'agents', 'reviewer.agent.agent.md'))).toBe(false)
	})

	// Neither kind has a documented extension on the runtime, so inventing one would be a guess.
	it('copies commands and rules under their authored names', () => {
		writeComponent('commands/ship.md', 'ship\n')
		writeComponent('rules/style.md', 'style\n')
		copilotManifest({ commands: './commands/', rules: './rules/' })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'commands', 'ship.md'))).toBe(true)
		expect(fs.existsSync(path.join(dir, NS, 'rules', 'style.md'))).toBe(true)
	})

	it('preserves the directory structure inside a copied kind', () => {
		writeComponent('agents/team/reviewer.agent.md', 'nested\n')
		copilotManifest({ agents: './agents/' })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'team', 'reviewer.agent.md'))).toBe(true)
	})

	it('reports the vendor as built at the namespace directory, leaving the canonical manifest alone', () => {
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({ agents: './agents/' })
		const canonicalBefore = fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')

		const result = buildPlugin(dir)

		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: `${NS}/`, status: 'built' }])
		expect(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')).toBe(canonicalBefore)
	})

	it('resolves a path array across every declared directory', () => {
		writeComponent('agents/a.agent.md', 'a\n')
		writeComponent('more-agents/b.agent.md', 'b\n')
		copilotManifest({ agents: ['./agents/', './more-agents/'] })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'a.agent.md'))).toBe(true)
		expect(fs.existsSync(path.join(dir, NS, 'agents', 'b.agent.md'))).toBe(true)
	})

	it('resolves a paths object across every declared directory', () => {
		writeComponent('agents/a.agent.md', 'a\n')
		writeComponent('more-agents/b.agent.md', 'b\n')
		copilotManifest({ agents: { paths: ['./agents/', './more-agents/'] } })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'a.agent.md'))).toBe(true)
		expect(fs.existsSync(path.join(dir, NS, 'agents', 'b.agent.md'))).toBe(true)
	})

	// The AXI aggregate appends "served by plugin.json N" only while some vendor is canonical, and
	// copilot-cli is no longer canonical unconditionally.
	it('reports no canonical vendor once copilot-cli derives its components', () => {
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({ agents: './agents/' })

		const result = buildPlugin(dir)

		expect(result.summary).toEqual({ built: 1, skipped: 0, failed: 0, canonical: 0 })
	})

	it('warns when a declared component directory does not exist', () => {
		copilotManifest({ agents: './agents/' })

		const result = buildPlugin(dir)

		expect(result.warnings).toEqual([`agents path "./agents/" not found — nothing copied to ${NS}/agents/`])
		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: 'plugin.json', status: 'canonical' }])
	})

	// The default is what an undeclared field means. Copilot reads these from the namespace whether or
	// not the manifest names them, so an undeclared agents/ is still content the plugin ships.
	it('reads the schema default when the field is absent', () => {
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({})

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'reviewer.agent.md'))).toBe(true)
	})

	// A declared path that did not resolve is a loss the author can fix; an unused default is not.
	it('does not warn when an undeclared default directory is simply absent', () => {
		writeSkill('reviewer', '---\nname: reviewer\ndescription: reviews\n---\nbody\n')
		copilotManifest({ skills: './skills/' })

		const result = buildPlugin(dir)

		expect(result.warnings).toEqual([])
		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: 'plugin.json', status: 'canonical' }])
	})

	it('warns and copies nothing when a declaration is in none of the three forms', () => {
		copilotManifest({ agents: 7 })

		const result = buildPlugin(dir)

		expect(result.warnings).toEqual([
			`agents declaration is not a path, a path list, or a { paths } object — nothing copied to ${NS}/agents/`,
		])
		expect(fs.existsSync(path.join(dir, NS, 'agents'))).toBe(false)
		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: 'plugin.json', status: 'canonical' }])
	})

	it('translates hooks to the fixed namespace path', () => {
		writeComponent(
			'hooks/hooks.json',
			`${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: './start.sh' }] }] } })}\n`,
		)
		copilotManifest({ hooks: './hooks/hooks.json' })

		buildPlugin(dir)

		const derived = JSON.parse(fs.readFileSync(path.join(dir, NS, 'hooks', 'hooks.json'), 'utf8'))
		expect(Object.keys(derived.hooks)).toEqual(['SessionStart'])
	})

	// Every derived kind flips the status, not only the copied ones: a plugin whose entire Copilot
	// content is one hook or one LSP entry still has a tree the runtime reads.
	it.each([
		[
			'hooks',
			{ hooks: './hooks/hooks.json' },
			'hooks/hooks.json',
			'{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"./x.sh"}]}]}}\n',
		],
		['commands', { commands: './commands/' }, 'commands/ship.md', 'ship\n'],
		['rules', { rules: './rules/' }, 'rules/style.md', 'style\n'],
		['lspServers', { lspServers: './.lsp.json' }, '.lsp.json', '{ "servers": {} }\n'],
	])('reports built when %s is the only derived kind', (_kind, config, file, content) => {
		writeComponent(file, content)
		copilotManifest(config)

		const result = buildPlugin(dir)

		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: `${NS}/`, status: 'built' }])
	})

	it('copies a declared lspServers path verbatim', () => {
		writeComponent('.lsp.json', '{ "servers": { "tf": { "command": "terraform-ls" } } }\n')
		copilotManifest({ lspServers: './.lsp.json' })

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(dir, NS, 'lsp.json'), 'utf8')).toBe(
			fs.readFileSync(path.join(dir, '.lsp.json'), 'utf8'),
		)
	})

	it('resolves an lspServers paths object to the namespace lsp.json', () => {
		writeComponent('.lsp.json', '{ "servers": { "tf": { "command": "terraform-ls" } } }\n')
		copilotManifest({ lspServers: { paths: ['./.lsp.json'] } })

		const result = buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'lsp.json'))).toBe(true)
		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: `${NS}/`, status: 'built' }])
	})

	// The file's top-level shape is not documented anywhere, so composing one would be a guess.
	it('warns rather than composing a namespace lsp.json from an inline map', () => {
		copilotManifest({ lspServers: { tf: { command: 'terraform-ls' } } })

		const result = buildPlugin(dir)

		expect(result.warnings).toEqual([
			'copilot-cli reads lspServers from com.github.copilot/lsp.json, and an inline map has no documented file shape to write — not delivered',
		])
		expect(fs.existsSync(path.join(dir, NS, 'lsp.json'))).toBe(false)
		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: 'plugin.json', status: 'canonical' }])
	})

	// skills/ and mcp.json are two paths spec mode leaves at the plugin root; a copy under the
	// namespace is one nothing reads.
	it('copies neither skills nor mcp.json into the namespace', () => {
		writeSkill('reviewer', '---\nname: reviewer\ndescription: reviews\n---\nbody\n')
		writeComponent('mcp.json', '{ "mcpServers": {} }\n')
		copilotManifest({ skills: './skills/', mcpServers: './mcp.json' })

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, NS, 'skills'))).toBe(false)
		expect(fs.existsSync(path.join(dir, NS, 'mcp.json'))).toBe(false)
	})

	it('leaves an authored extensions directory untouched', () => {
		writeComponent(`${NS}/extensions/canvas/extension.json`, '{ "name": "canvas" }\n')
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({ agents: './agents/' })

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(dir, NS, 'extensions', 'canvas', 'extension.json'), 'utf8')).toBe(
			'{ "name": "canvas" }\n',
		)
	})

	// The status names what the build derived, never what the directory happens to hold. Extensions
	// are authored under the namespace, so their presence alone is not a derivation.
	it('does not report built for a plugin whose only namespace content is authored extensions', () => {
		writeComponent(`${NS}/extensions/canvas/extension.json`, '{ "name": "canvas" }\n')
		writeSkill('reviewer', '---\nname: reviewer\ndescription: reviews\n---\nbody\n')
		copilotManifest({ skills: './skills/' })

		const result = buildPlugin(dir)

		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: 'plugin.json', status: 'canonical' }])
	})

	it('--clean removes a stale derived file but keeps authored extensions', () => {
		writeComponent(`${NS}/agents/removed.agent.md`, 'gone\n')
		writeComponent(`${NS}/extensions/canvas/extension.json`, '{ "name": "canvas" }\n')
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({ agents: './agents/' })

		buildPlugin(dir, { clean: true })

		expect(fs.existsSync(path.join(dir, NS, 'agents', 'removed.agent.md'))).toBe(false)
		expect(fs.existsSync(path.join(dir, NS, 'agents', 'reviewer.agent.md'))).toBe(true)
		expect(fs.existsSync(path.join(dir, NS, 'extensions', 'canvas', 'extension.json'))).toBe(true)
	})

	it('--dry-run reports the vendor as built and writes nothing', () => {
		writeComponent('agents/reviewer.agent.md', 'agent\n')
		copilotManifest({ agents: './agents/' })

		const result = buildPlugin(dir, { dryRun: true })

		expect(result.rows).toEqual([{ vendor: 'copilot-cli', path: `${NS}/`, status: 'built' }])
		expect(result.written).toEqual([path.join(dir, NS, 'agents', 'reviewer.agent.md')])
		expect(fs.existsSync(path.join(dir, NS))).toBe(false)
	})
})
