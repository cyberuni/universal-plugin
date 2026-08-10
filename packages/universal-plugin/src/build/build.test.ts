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
	fs.mkdirSync(path.join(dir, '.plugin'))
})

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
	fs.rmSync(home, { recursive: true, force: true })
})

function writeManifest(manifest: object, indent?: string | number) {
	fs.writeFileSync(path.join(dir, '.plugin', 'plugin.json'), JSON.stringify(manifest, null, indent))
}

function writeSkill(name: string, content: string) {
	const skillDir = path.join(dir, 'skills', name)
	fs.mkdirSync(skillDir, { recursive: true })
	fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content)
}

describe('readManifest', () => {
	it('throws when .plugin/plugin.json is missing', () => {
		const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-empty-'))
		try {
			expect(() => readManifest(empty)).toThrow('No .plugin/plugin.json')
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
	it('throws the friendly error when .plugin/plugin.json is missing', () => {
		const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-empty-'))
		try {
			// Guards the CLI code path (buildPlugin), not just readManifest — the raw indent
			// read must not shadow the friendly "No .plugin/plugin.json found" message.
			expect(() => buildPlugin(empty)).toThrow('No .plugin/plugin.json found')
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
		const errors = validateManifest({ name: 'x', version: '1.0.0', vendorExtensions: { codex: {} } })
		expect(errors).toContain('description is required when targeting codex')
	})

	it('returns error when codex vendor lacks version', () => {
		const errors = validateManifest({ name: 'x', description: 'y', vendorExtensions: { codex: {} } })
		expect(errors).toContain('version is required when targeting codex')
	})

	it('returns no errors for valid manifest', () => {
		const errors = validateManifest({ name: 'x', vendorExtensions: { 'claude-code': {} } })
		expect(errors).toHaveLength(0)
	})
})

describe('buildPlugin', () => {
	it('returns empty result with warning when vendorExtensions is absent', () => {
		writeManifest({ name: 'my-plugin' })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.vendors).toHaveLength(0)
		expect(result.warnings[0]).toMatch(/nothing to build/)
	})

	it('lists vendors from vendorExtensions keys', () => {
		writeManifest({ name: 'my-plugin', vendorExtensions: { 'claude-code': {}, cursor: {} } })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.vendors).toEqual(['claude-code', 'cursor'])
	})

	it('warns and skips unknown vendors', () => {
		writeManifest({ name: 'my-plugin', vendorExtensions: { unknown: {} } })
		const result = buildPlugin(dir, { dryRun: true })
		expect(result.warnings[0]).toMatch(/Unknown vendor/)
		expect(result.vendors).toHaveLength(0)
	})

	it('--vendor filters to a single vendor', () => {
		writeManifest({ name: 'my-plugin', vendorExtensions: { 'claude-code': {}, cursor: {} } })
		const result = buildPlugin(dir, { dryRun: true, vendor: 'claude-code' })
		expect(result.vendors).toEqual(['claude-code'])
	})

	it('throws when --vendor is not in vendorExtensions', () => {
		writeManifest({ name: 'my-plugin', vendorExtensions: { 'claude-code': {} } })
		expect(() => buildPlugin(dir, { vendor: 'cursor' })).toThrow('not declared')
	})

	it('writes vendor manifests with merged fields', () => {
		writeManifest({
			name: 'my-plugin',
			skills: './skills/',
			vendorExtensions: { 'claude-code': { displayName: 'My Plugin' } },
		})
		buildPlugin(dir)
		const written = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8'))
		expect(written.name).toBe('my-plugin')
		expect(written.skills).toBe('./skills/')
		expect(written.displayName).toBe('My Plugin')
		expect(written.vendorExtensions).toBeUndefined()
		expect(written.$schema).toBeUndefined()
	})

	it('uses tab indentation by default when .plugin/plugin.json has no indentation', () => {
		writeManifest({ name: 'x', vendorExtensions: { 'claude-code': {} } })
		buildPlugin(dir)
		const raw = fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')
		expect(raw).toContain('\t')
	})

	it('vendor output follows tab indentation from .plugin/plugin.json', () => {
		writeManifest({ name: 'x', vendorExtensions: { 'claude-code': {} } }, '\t')
		buildPlugin(dir)
		const raw = fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')
		expect(raw).toContain('\t')
		expect(raw).not.toMatch(/\n {2}/)
	})

	it('vendor output follows 2-space indentation from .plugin/plugin.json', () => {
		writeManifest({ name: 'x', vendorExtensions: { 'claude-code': {} } }, 2)
		buildPlugin(dir)
		const raw = fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8')
		expect(raw).toContain('\n  ')
		expect(raw).not.toContain('\t')
	})

	it('derives a Cursor command from a user-invocable skill', () => {
		writeManifest({ name: 'x', vendorExtensions: { cursor: {} } })
		writeSkill('deploy', '---\ninvocation-policy: user\ndescription: Deploy safely\n---\nDeploy $ARGUMENTS.')

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(dir, '.cursor', 'commands', 'deploy.md'), 'utf8')).toBe('Deploy $ARGUMENTS.')
	})

	it('derives a best-effort Codex prompt from a both-invocable skill', () => {
		writeManifest({ name: 'x', version: '1.0.0', description: 'x', vendorExtensions: { codex: {} } })
		writeSkill('review', '---\ninvocation-policy: both\n---\nReview the current diff.')

		buildPlugin(dir)

		expect(fs.readFileSync(path.join(home, '.codex', 'prompts', 'review.md'), 'utf8')).toBe('Review the current diff.')
	})

	it('does not derive a command from a model-only skill', () => {
		writeManifest({ name: 'x', vendorExtensions: { cursor: {} } })
		writeSkill('context', '---\ninvocation-policy: model\n---\nBackground context.')

		buildPlugin(dir)

		expect(fs.existsSync(path.join(dir, '.cursor', 'commands', 'context.md'))).toBe(false)
	})

	it('maps canonical invocation policies to Claude frontmatter', () => {
		writeManifest({ name: 'x', vendorExtensions: { 'claude-code': {} } })
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
		writeManifest({ name: 'x', vendorExtensions: { cursor: {} } })
		writeSkill('invalid', '---\ninvocation-policy: never\n---\nNope.')

		expect(() => buildPlugin(dir)).toThrow('expected user, model, or both')
	})
})
