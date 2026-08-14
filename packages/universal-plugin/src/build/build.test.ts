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

	it('derives a Cursor command from a user-invocable skill', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { cursor: {} } }) })
		writeSkill('deploy', '---\ninvocation-policy: user\ndescription: Deploy safely\n---\nDeploy $ARGUMENTS.')

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(dir, '.cursor', 'commands', 'deploy.md'), 'utf8')).toBe('Deploy $ARGUMENTS.')
	})

	it('derives a best-effort Codex prompt from a both-invocable skill', () => {
		writeManifest({ name: 'x', version: '1.0.0', description: 'x', extensions: up({ harnesses: { codex: {} } }) })
		writeSkill('review', '---\ninvocation-policy: both\n---\nReview the current diff.')

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(home, '.codex', 'prompts', 'review.md'), 'utf8')).toBe('Review the current diff.')
	})

	it('does not derive a command from a model-only skill', () => {
		writeManifest({ name: 'x', extensions: up({ harnesses: { cursor: {} } }) })
		writeSkill('context', '---\ninvocation-policy: model\n---\nBackground context.')

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, '.cursor', 'commands', 'context.md'))).toBe(false)
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
