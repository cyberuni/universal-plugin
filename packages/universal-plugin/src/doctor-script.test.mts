import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

/** The `doctor` skill's script is the home of the ADR-0010 §6 check: a runtime keys its plugin cache
 *  on the version, so content committed after the commit that set the current one never reaches a
 *  consumer who already installed the plugin. The check reads git, so these cases are git fixtures. */
const doctor = path.resolve('skills/doctor/scripts/doctor.mjs')

let root: string

beforeEach(() => {
	root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-doctor-')))
	git('init', '--initial-branch', 'main')
	git('config', 'user.email', 'doctor@example.test')
	git('config', 'user.name', 'doctor')
})
afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true })
})

function git(...args: string[]) {
	const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
	return result.stdout
}

function commit(message: string) {
	git('add', '-A')
	git('commit', '-q', '-m', message)
}

function write(rel: string, content: string) {
	const target = path.join(root, rel)
	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, content)
}

function writeManifest(version: string) {
	write(
		'plugin.json',
		`${JSON.stringify(
			{
				$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
				name: 'demo',
				version,
				description: 'a demo plugin',
				extensions: { 'org.cyberuni.universal-plugin': { vendors: ['claude-code'] } },
			},
			null,
			2,
		)}\n`,
	)
}

function writeSkill(body: string) {
	write('skills/demo/SKILL.md', `---\nname: demo\ndescription: a demo skill\n---\n\n${body}\n`)
}

/** The codes `doctor` reported. Other findings (an unbuilt vendor, say) are expected in a fixture
 *  that never runs `plugin build`, so every case asserts on presence, not on the whole list. */
function findings(): string[] {
	const result = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	expect(result.status).toBe(0)
	const report = JSON.parse(result.stdout) as { findings: { code: string; detail: string }[] }
	return report.findings.map((f) => f.code)
}

function detail(code: string): string {
	const result = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	const report = JSON.parse(result.stdout) as { findings: { code: string; detail: string }[] }
	return report.findings.find((f) => f.code === code)?.detail ?? ''
}

function seedRelease(version = '1.0.0') {
	writeManifest(version)
	writeSkill('the shipped body')
	commit(`release ${version}`)
}

test('shipped content committed after the version was set is reported', () => {
	seedRelease()
	writeSkill('a body the released version does not carry')
	commit('add to the skill')

	expect(findings()).toContain('unreleased-content')
	expect(detail('unreleased-content')).toContain('skills/demo/SKILL.md')
	expect(detail('unreleased-content')).toContain('1.0.0')
})

test('a tree whose shipped content has not moved since the version reports nothing', () => {
	seedRelease()

	expect(findings()).not.toContain('unreleased-content')
})

test('a bump that carries the content clears the finding', () => {
	seedRelease()
	writeSkill('a body the released version does not carry')
	commit('add to the skill')
	writeManifest('1.0.1')
	commit('bump to 1.0.1')

	expect(findings()).not.toContain('unreleased-content')
})

test('uncommitted work is not reported — nothing has shipped yet', () => {
	seedRelease()
	writeSkill('an edit still in the working tree')

	expect(findings()).not.toContain('unreleased-content')
})

test('a plugin that ships to npm is left alone — the release moves the number there', () => {
	seedRelease()
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', '{ "name": "demo", "version": "1.0.0" }\n')
	writeSkill('a body the released version does not carry')
	commit('add to the skill')

	expect(findings()).not.toContain('unreleased-content')
})

test('packagePath is read from .agents/universal-plugin.json, where the CLI writes it', () => {
	seedRelease()
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', '{ "name": "demo", "version": "2.0.0" }\n')
	commit('declare the package')

	expect(findings()).toContain('version-drift')
	expect(detail('version-drift')).toContain('2.0.0')
})

test('a plugin outside any git repository is skipped rather than guessed at', () => {
	seedRelease()
	fs.rmSync(path.join(root, '.git'), { recursive: true, force: true })

	expect(findings()).not.toContain('unreleased-content')
})

// The catalogs a user installs from sit at the repository root, and each is refused at install time
// rather than here. `owner` as a string is the shape that reaches a repository unnoticed.
test('a catalog its runtime would refuse is reported, with the key at fault', () => {
	seedRelease()
	write(
		'.claude-plugin/marketplace.json',
		`${JSON.stringify({ name: 'demo', owner: 'Ari Vance', plugins: [{ name: 'demo', source: './' }] }, null, 2)}\n`,
	)
	expect(findings()).toContain('invalid-catalog')
	expect(detail('invalid-catalog')).toMatch(/owner must be an object with a name/)
})

test('a repository whose catalogs load reports nothing about them', () => {
	seedRelease()
	write(
		'.claude-plugin/marketplace.json',
		`${JSON.stringify(
			{ name: 'demo', owner: { name: 'Ari Vance' }, plugins: [{ name: 'demo', source: './' }] },
			null,
			2,
		)}\n`,
	)
	expect(findings()).not.toContain('invalid-catalog')
})

// issue #61 — the pre-0.6 layout. `plugin build` now stops on it rather than reporting a definitive
// empty state, so doctor must keep naming the cause instead of falling back to `build-failed`.
test('a repo left on the pre-0.6 layout still reports the layout findings and no-vendors', () => {
	write(
		'plugin.json',
		`${JSON.stringify({ name: 'demo', version: '1.0.0', vendorExtensions: { 'claude-code': {} } }, null, 2)}\n`,
	)
	write('.plugin/plugin.json', `${JSON.stringify({ name: 'demo' }, null, 2)}\n`)
	commit('a repo on the pre-0.6 layout')

	const codes = findings()
	expect(codes).toContain('legacy-manifest')
	expect(codes).toContain('shadowing-manifest')
	expect(codes).toContain('no-vendors')
	expect(codes).not.toContain('build-failed')
})

// Declaring the canonical $schema puts a plugin in Copilot CLI's spec mode, which reads agents,
// commands, rules, hooks and lsp.json only under com.github.copilot/ (ADR-0015). A root-only layout
// loads none of them there and nothing at runtime says so — this finding is what says so.
test('reports declared components left at the plugin root with no com.github.copilot copy', () => {
	write(
		'plugin.json',
		`${JSON.stringify(
			{
				$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
				name: 'demo',
				version: '1.0.0',
				description: 'a demo plugin',
				extensions: {
					'org.cyberuni.universal-plugin': { agents: './agents/', harnesses: { 'copilot-cli': {} } },
				},
			},
			null,
			2,
		)}\n`,
	)
	write('agents/reviewer.agent.md', '---\nname: reviewer\n---\nreview\n')
	commit('a plugin whose agents never reach copilot')

	const report = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	const parsed = JSON.parse(report.stdout) as { findings: { code: string; detail: string }[] }
	const finding = parsed.findings.find((f) => f.code === 'copilot-root-components')
	expect(finding?.detail).toContain('agents')
	expect(finding?.detail).toContain('com.github.copilot/')
})

test('reports nothing once the namespace copy exists', () => {
	write(
		'plugin.json',
		`${JSON.stringify(
			{
				$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
				name: 'demo',
				version: '1.0.0',
				description: 'a demo plugin',
				extensions: {
					'org.cyberuni.universal-plugin': { agents: './agents/', harnesses: { 'copilot-cli': {} } },
				},
			},
			null,
			2,
		)}\n`,
	)
	write('agents/reviewer.agent.md', '---\nname: reviewer\n---\nreview\n')
	write('com.github.copilot/agents/reviewer.agent.md', '---\nname: reviewer\n---\nreview\n')
	commit('a plugin whose agents do reach copilot')

	expect(findings()).not.toContain('copilot-root-components')
})

// A plugin that declares none of the moved kinds has nothing to copy — copilot-cli reading the
// canonical manifest is the whole story, and reporting it would be a false positive.
test('reports nothing when the plugin declares no component of a moved kind', () => {
	writeManifest('1.0.0')
	writeSkill('a skill')
	commit('a skills-only plugin')

	expect(findings()).not.toContain('copilot-root-components')
})
