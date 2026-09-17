import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadInstruction } from './copy.js'
import { syncGovernanceCopies } from './copy-sync.js'
import { realGovernanceCopyFs } from './fs.js'

let dir: string

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-governance-'))
})

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
})

/** Writes a governance the plugin being built owns. */
function ownGovernance(name: string, content: string) {
	const file = path.join(dir, 'governances', `${name}.md`)
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, content)
}

/** Installs a package under node_modules that owns `governances/<name>.md`. */
function dependencyGovernance(pkg: string, name: string, content: string) {
	const pkgDir = path.join(dir, 'node_modules', pkg)
	fs.mkdirSync(path.join(pkgDir, 'governances'), { recursive: true })
	fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: pkg, version: '1.0.0' }))
	fs.writeFileSync(path.join(pkgDir, 'governances', `${name}.md`), content)
	const manifestPath = path.join(dir, 'package.json')
	const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { name: 'demo' }
	manifest.devDependencies = { ...manifest.devDependencies, [pkg]: '^1.0.0' }
	fs.writeFileSync(manifestPath, JSON.stringify(manifest))
}

/** Creates a skill, optionally declaring governances by the files in its copy folder. */
function writeSkill(name: string, opts: { references?: string; declares?: string[] } = {}) {
	const skillDir = path.join(dir, 'skills', name)
	fs.mkdirSync(skillDir, { recursive: true })
	const references =
		opts.references ?? (opts.declares ?? []).map((g) => `- \`references/governances/${g}.md\``).join('\n')
	fs.writeFileSync(
		path.join(skillDir, 'SKILL.md'),
		`---\nname: ${name}\n---\n\n# ${name}\n\n## References\n\n${references}\n`,
	)
	for (const declared of opts.declares ?? []) {
		const file = path.join(skillDir, 'references', 'governances', `${declared}.md`)
		fs.mkdirSync(path.dirname(file), { recursive: true })
		// A declaration is a file; its content does not matter, the build rewrites it from the owner.
		fs.writeFileSync(file, '')
	}
	return { path: path.join(skillDir, 'SKILL.md'), name }
}

function sync(skills: { path: string; name: string }[], opts: { check?: boolean; dryRun?: boolean } = {}) {
	return syncGovernanceCopies(dir, skills, realGovernanceCopyFs, opts)
}

function copyOf(skill: string, name: string) {
	return fs.readFileSync(path.join(dir, 'skills', skill, 'references', 'governances', `${name}.md`), 'utf8')
}

describe('syncGovernanceCopies', () => {
	it('skips a skill with no declaration folder', () => {
		const skill = writeSkill('plain')
		const result = sync([skill])
		expect(result).toEqual({ entries: [], errors: [] })
	})

	it('rewrites a declared file from the governance the plugin itself owns', () => {
		ownGovernance('plugin-design', '# Plugin Design\n\nAuthor plugin.json at the root.\n')
		const skill = writeSkill('init', { declares: ['plugin-design'] })

		const result = sync([skill])

		expect(result.errors).toEqual([])
		expect(result.entries).toEqual([
			expect.objectContaining({ skill: 'init', name: 'plugin-design', owner: '.', status: 'written' }),
		])
		expect(copyOf('init', 'plugin-design')).toBe('# Plugin Design\n\nAuthor plugin.json at the root.\n')
	})

	it('resolves a governance from an installed dependency', () => {
		dependencyGovernance('cyberplace', 'skill-design', '# Skill Design\n')
		const skill = writeSkill('init', { declares: ['skill-design'] })

		const result = sync([skill])

		expect(result.errors).toEqual([])
		expect(result.entries[0]).toMatchObject({ owner: 'cyberplace', status: 'written' })
	})

	it('prefers the governance the plugin owns over a dependency that ships the same name', () => {
		ownGovernance('plugin-design', '# Ours\n')
		dependencyGovernance('cyberplace', 'plugin-design', '# Theirs\n')
		const skill = writeSkill('init', { declares: ['plugin-design'] })

		sync([skill])

		expect(copyOf('init', 'plugin-design')).toBe('# Ours\n')
	})

	it('copies a governance a copied governance references, transitively', () => {
		ownGovernance('plugin-design', '# Plugin Design\n\nSee `governance show skill-design`.\n')
		dependencyGovernance('cyberplace', 'skill-design', '# Skill Design\n\nSee `governance show agent-tool-output`.\n')
		dependencyGovernance('cyberplace', 'agent-tool-output', '# Agent Tool Output\n')
		const skill = writeSkill('init', {
			declares: ['plugin-design'],
			references: [
				'- `references/governances/plugin-design.md`',
				'- `references/governances/skill-design.md`',
				'- `references/governances/agent-tool-output.md`',
			].join('\n'),
		})

		const result = sync([skill])

		expect(result.errors).toEqual([])
		expect(result.entries.map((e) => e.name)).toEqual(['plugin-design', 'skill-design', 'agent-tool-output'])
		expect(copyOf('init', 'agent-tool-output')).toBe('# Agent Tool Output\n')
	})

	it('rewrites a pointer inside a copy to name the sibling copy', () => {
		ownGovernance('plugin-design', '# Plugin Design\n\nSee `npx cyberplace@1 governance show skill-design`.\n')
		dependencyGovernance('cyberplace', 'skill-design', '# Skill Design\n')
		const skill = writeSkill('init', {
			references: ['- `references/governances/plugin-design.md`', '- `references/governances/skill-design.md`'].join(
				'\n',
			),
			declares: ['plugin-design'],
		})

		sync([skill])

		expect(copyOf('init', 'plugin-design')).toBe(`# Plugin Design\n\n${loadInstruction('skill-design')}\n`)
	})

	it('fails when a declared file names no governance any package owns', () => {
		const skill = writeSkill('init', { declares: ['no-such-rule'] })

		const result = sync([skill])

		expect(result.errors).toHaveLength(1)
		expect(result.errors[0]).toContain('references/governances/no-such-rule.md names no governance')
		expect(result.entries).toEqual([])
	})

	it('fails when a referenced governance has no copy to point at', () => {
		ownGovernance('plugin-design', '# Plugin Design\n\nSee `governance show skill-design`.\n')
		const skill = writeSkill('init', { declares: ['plugin-design'] })

		const result = sync([skill])

		expect(result.errors.join('\n')).toContain('governance "plugin-design" references "skill-design"')
	})

	it('fails when SKILL.md does not list a copy under References', () => {
		ownGovernance('plugin-design', '# Plugin Design\n')
		const skill = writeSkill('init', { declares: ['plugin-design'], references: '- Spec: https://x.invalid' })

		const result = sync([skill])

		expect(result.errors).toEqual([
			'skill "init": SKILL.md does not list `references/governances/plugin-design.md` under References.',
		])
	})

	it('reports an up-to-date copy as unchanged and writes nothing', () => {
		ownGovernance('plugin-design', '# Plugin Design\n')
		const skill = writeSkill('init', { declares: ['plugin-design'] })
		sync([skill])
		const before = fs.statSync(
			path.join(dir, 'skills', 'init', 'references', 'governances', 'plugin-design.md'),
		).mtimeMs

		const result = sync([skill])

		expect(result.entries[0]).toMatchObject({ status: 'unchanged' })
		expect(fs.statSync(path.join(dir, 'skills', 'init', 'references', 'governances', 'plugin-design.md')).mtimeMs).toBe(
			before,
		)
	})

	it('reports drift as stale and writes nothing under --check', () => {
		ownGovernance('plugin-design', '# Plugin Design\n')
		const skill = writeSkill('init', { declares: ['plugin-design'] })

		const result = sync([skill], { check: true })

		expect(result.entries[0]).toMatchObject({ status: 'stale' })
		expect(copyOf('init', 'plugin-design')).toBe('')
	})

	it('still fails a check run when a copy names no governance', () => {
		const skill = writeSkill('init', { declares: ['no-such-rule'] })
		expect(sync([skill], { check: true }).errors).toHaveLength(1)
	})
})
