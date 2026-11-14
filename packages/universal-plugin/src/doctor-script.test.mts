import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'

// Every case spawns the doctor script, which spawns the CLI and git; a cold CI runner exceeds the 5s default.
vi.setConfig({ testTimeout: 30_000 })

/** The `doctor` skill's script is the home of the ADR-0010 §6 check: a runtime keys its plugin cache
 *  on the version, so content committed after the commit that set the current one never reaches a
 *  consumer who already installed the plugin. The check reads git, so these cases are git fixtures. */
const doctor = path.resolve('skills/doctor-universal-plugin/scripts/doctor.mjs')

let root: string

/** The doctor script asks the CLI through `pnpm exec universal-plugin`, because a compiled skill script
 *  carries no CLI beside it. A shim named `pnpm` stands in for the project's install: it runs this
 *  checkout's built CLI. */
const originalPath = process.env.PATH
let shimDir: string
beforeAll(() => {
	shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-pnpm-shim-'))
	const cli = path.resolve('bin/universal-plugin.mjs')
	fs.writeFileSync(
		path.join(shimDir, 'pnpm'),
		`#!/bin/sh\n[ "$1" = exec ] && [ "$2" = universal-plugin ] || exit 1\nshift 2\nexec node ${cli} "$@"\n`,
		{ mode: 0o755 },
	)
	process.env.PATH = `${shimDir}${path.delimiter}${originalPath}`
})
afterAll(() => {
	process.env.PATH = originalPath
	fs.rmSync(shimDir, { recursive: true, force: true })
})

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
function findings(extraArgs: string[] = []): string[] {
	const result = spawnSync('node', [doctor, '--root', root, ...extraArgs], { encoding: 'utf8' })
	expect(result.status).toBe(0)
	const report = JSON.parse(result.stdout) as { findings: { code: string; detail: string }[] }
	return report.findings.map((f) => f.code)
}

function detail(code: string, extraArgs: string[] = []): string {
	const result = spawnSync('node', [doctor, '--root', root, ...extraArgs], { encoding: 'utf8' })
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

// A non-npm plugin a release tool versions is in the same release model as packagePath: the tool
// moves the number at release time, so content ahead of the last release is the normal state.
/** Content committed after the release, in a tree that carries `setup`'s release-tool config. */
function unreleasedUnder(setup: () => void) {
	seedRelease()
	setup()
	commit('set up the release tool')
	writeSkill('a body the released version does not carry')
	commit('add to the skill')
	return findings()
}

test('a non-npm plugin changesets releases through a private package.json is left alone', () => {
	const codes = unreleasedUnder(() => {
		write('.changeset/config.json', '{}\n')
		write('package.json', '{ "name": "demo", "private": true, "version": "1.0.0" }\n')
	})
	expect(codes).not.toContain('unreleased-content')
})

test('a private package.json with no changesets is still the author-picks model', () => {
	const codes = unreleasedUnder(() =>
		write('package.json', '{ "name": "demo", "private": true, "version": "1.0.0" }\n'),
	)
	expect(codes).toContain('unreleased-content')
})

test('a plugin release-please bumps through extra-files is left alone', () => {
	const codes = unreleasedUnder(() => {
		write(
			'release-please-config.json',
			`${JSON.stringify({ packages: { '.': { 'release-type': 'simple', 'extra-files': [{ type: 'json', path: 'plugin.json', jsonpath: '$.version' }] } } })}\n`,
		)
		write('.release-please-manifest.json', '{ ".": "1.0.0" }\n')
	})
	expect(codes).not.toContain('unreleased-content')
})

test('a release-please config that does not bump this plugin.json does not silence the check', () => {
	const codes = unreleasedUnder(() =>
		write('release-please-config.json', `${JSON.stringify({ packages: { 'packages/other': {} } })}\n`),
	)
	expect(codes).toContain('unreleased-content')
})

test.each([
	['.releaserc.json', '{ "branches": ["main"] }\n'],
	['.releaserc', 'branches: [main]\n'],
	['release.config.mjs', 'export default { branches: ["main"] }\n'],
	['.config/releaserc.yaml', 'branches: [main]\n'],
	['package.json', '{ "name": "demo", "private": true, "release": { "branches": ["main"] } }\n'],
])('a plugin semantic-release versions (%s) is left alone', (file, content) => {
	expect(unreleasedUnder(() => write(file, content))).not.toContain('unreleased-content')
})

test.each([
	['.release-it.json', '{ "npm": { "publish": false } }\n'],
	['package.json', '{ "name": "demo", "private": true, "release-it": { "npm": { "publish": false } } }\n'],
])('a plugin release-it versions (%s) is left alone', (file, content) => {
	expect(unreleasedUnder(() => write(file, content))).not.toContain('unreleased-content')
})

test('a public package.json that publishes plugin.json with no packagePath is reported (#261)', () => {
	seedRelease()
	write('package.json', '{ "name": "demo", "version": "1.0.0", "files": ["plugin.json", "skills/"] }\n')
	commit('ship through npm')

	expect(findings()).toContain('undeclared-package-path')
})

test('the undeclared package is still compared for version drift (#261)', () => {
	seedRelease()
	write('package.json', '{ "name": "demo", "version": "2.0.0" }\n')
	commit('bump the package only')

	expect(detail('version-drift')).toBe('plugin.json is 1.0.0, package.json is 2.0.0')
})

test.each([
	['a private package', '{ "name": "demo", "version": "1.0.0", "private": true }\n'],
	['a package whose files leave plugin.json out', '{ "name": "demo", "version": "1.0.0", "files": ["dist/"] }\n'],
])('%s at the plugin root is not reported as undeclared', (_, content) => {
	seedRelease()
	write('package.json', content)
	commit('add a package')

	expect(findings()).not.toContain('undeclared-package-path')
})

test('a declared packagePath is not reported as undeclared', () => {
	seedRelease()
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', '{ "name": "demo", "version": "1.0.0" }\n')
	commit('declare the package')

	expect(findings()).not.toContain('undeclared-package-path')
})

test('packagePath is asked of the CLI, which reads .agents/universal-plugin.json', () => {
	seedRelease()
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', '{ "name": "demo", "version": "2.0.0" }\n')
	commit('declare the package')

	expect(findings()).toContain('version-drift')
	expect(detail('version-drift')).toContain('2.0.0')
})

test('packagePath resolves from the plugin root, so a monorepo package sits beside the plugin', () => {
	write('plugins/demo/.agents/universal-plugin.json', '{ "packagePath": "../../packages/demo" }\n')
	write('packages/demo/package.json', '{ "name": "demo", "version": "2.0.0" }\n')
	const pluginRoot = path.join(root, 'plugins/demo')
	fs.writeFileSync(
		path.join(pluginRoot, 'plugin.json'),
		`${JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'demo', version: '1.0.0', extensions: { 'org.cyberuni.universal-plugin': { vendors: ['claude-code'] } } }, null, 2)}\n`,
	)
	const result = spawnSync('node', [doctor, '--root', pluginRoot], { encoding: 'utf8' })
	const report = JSON.parse(result.stdout) as { findings: { code: string; detail: string }[] }
	const codes = report.findings.map((f) => f.code)
	expect(codes).not.toContain('package-path-missing')
	expect(codes).toContain('version-drift')
})

test('every file a release left behind is its own version-drift finding, named by path', () => {
	seedRelease('0.8.0')
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', '{ "name": "demo-cli", "version": "0.9.0" }\n')
	write('.claude-plugin/plugin.json', '{ "name": "demo", "version": "0.8.0" }\n')
	writeSkill('Run `npx -y demo-cli@0.8.0 go`.')

	const result = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	const report = JSON.parse(result.stdout) as { findings: { code: string; detail: string }[] }
	const drift = report.findings.filter((f) => f.code === 'version-drift').map((f) => f.detail)
	expect(drift).toEqual([
		'plugin.json is 0.8.0, package.json is 0.9.0',
		'.claude-plugin/plugin.json is 0.8.0, package.json is 0.9.0',
		'skills/demo/SKILL.md is 0.8.0, package.json is 0.9.0',
	])
})

test('a derived manifest left behind drifts even without an npm package', () => {
	seedRelease('1.0.0')
	write('.claude-plugin/plugin.json', '{ "name": "demo", "version": "0.9.0" }\n')

	expect(detail('version-drift')).toBe('.claude-plugin/plugin.json is 0.9.0, plugin.json is 1.0.0')
})

test('a packagePath declared in the manifest extension is reported, and not honored', () => {
	seedRelease()
	const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'))
	manifest.extensions['org.cyberuni.universal-plugin'].packagePath = '.'
	write('plugin.json', `${JSON.stringify(manifest, null, 2)}\n`)
	// Private, so the package is not inferred either (#261): only the misplaced declaration could name it.
	write('package.json', '{ "name": "demo", "version": "2.0.0", "private": true }\n')
	commit('declare the package in the manifest')

	const codes = findings()
	expect(codes).toContain('misplaced-package-path')
	expect(codes).not.toContain('version-drift')
	expect(detail('misplaced-package-path')).toContain('never reads')
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

// A shared marketplace repository (e.g. cyberuni/cyberplace) is cloned separately from the plugin —
// nothing at the plugin's own repository root sees a bad entry that reached it another way (issue #74).
test('a bad entry in a separately-cloned marketplace repository is reported via --marketplace-root', () => {
	seedRelease()
	const marketplaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-marketplace-'))
	try {
		fs.mkdirSync(path.join(marketplaceRoot, '.claude-plugin'), { recursive: true })
		fs.writeFileSync(
			path.join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
			`${JSON.stringify({ name: 'shared', owner: 'Ari Vance', plugins: [{ name: 'demo', source: './' }] }, null, 2)}\n`,
		)

		const codes = findings(['--marketplace-root', marketplaceRoot])
		expect(codes).toContain('invalid-catalog')
		expect(detail('invalid-catalog', ['--marketplace-root', marketplaceRoot])).toMatch(
			/owner must be an object with a name/,
		)
		expect(detail('invalid-catalog', ['--marketplace-root', marketplaceRoot])).toContain(marketplaceRoot)
	} finally {
		fs.rmSync(marketplaceRoot, { recursive: true, force: true })
	}
})

test('a clean shared marketplace repository reports nothing, and its own repo is still checked', () => {
	seedRelease()
	write(
		'.claude-plugin/marketplace.json',
		`${JSON.stringify({ name: 'demo', owner: 'Ari Vance', plugins: [{ name: 'demo', source: './' }] }, null, 2)}\n`,
	)
	const marketplaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-marketplace-'))
	try {
		fs.mkdirSync(path.join(marketplaceRoot, '.claude-plugin'), { recursive: true })
		fs.writeFileSync(
			path.join(marketplaceRoot, '.claude-plugin', 'marketplace.json'),
			`${JSON.stringify({ name: 'shared', owner: { name: 'Ari Vance' }, plugins: [{ name: 'demo', source: './' }] }, null, 2)}\n`,
		)

		expect(findings(['--marketplace-root', marketplaceRoot])).toContain('invalid-catalog')
	} finally {
		fs.rmSync(marketplaceRoot, { recursive: true, force: true })
	}
})

test('a --marketplace-root that does not exist is reported rather than silently skipped', () => {
	seedRelease()
	const missing = path.join(root, 'does-not-exist')

	expect(findings(['--marketplace-root', missing])).toContain('marketplace-root-missing')
	expect(detail('marketplace-root-missing', ['--marketplace-root', missing])).toContain(missing)
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
// The build derives from the schema's default when the manifest names no path, so a check that only
// fired on a declared path would miss the manifest that names none — the common one.
test('reports components at the default path even when the manifest declares none', () => {
	write(
		'plugin.json',
		`${JSON.stringify(
			{
				$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
				name: 'demo',
				version: '1.0.0',
				description: 'a demo plugin',
				extensions: { 'org.cyberuni.universal-plugin': { harnesses: { 'copilot-cli': {} } } },
			},
			null,
			2,
		)}\n`,
	)
	write('agents/reviewer.md', '---\nname: reviewer\n---\nreview\n')
	// The tree exists but holds no agents, so the generic existence check would pass it.
	write('com.github.copilot/extensions/canvas/extension.json', '{ "name": "canvas" }\n')
	commit('a plugin whose undeclared agents never reach copilot')

	const report = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	const parsed = JSON.parse(report.stdout) as { findings: { code: string; detail: string }[] }
	expect(parsed.findings.find((f) => f.code === 'copilot-root-components')?.detail).toContain('agents')
})

test('reports nothing when the plugin declares no component of a moved kind', () => {
	writeManifest('1.0.0')
	writeSkill('a skill')
	commit('a skills-only plugin')

	expect(findings()).not.toContain('copilot-root-components')
})

test('a component path a targeted vendor has none of is reported as unsupported-component', () => {
	write(
		'plugin.json',
		`${JSON.stringify(
			{
				$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
				name: 'demo',
				version: '1.0.0',
				description: 'a demo plugin',
				extensions: { 'org.cyberuni.universal-plugin': { vendors: ['codex'], agents: './agents/' } },
			},
			null,
			2,
		)}\n`,
	)

	expect(findings()).toContain('unsupported-component')
	expect(detail('unsupported-component')).toContain('codex has no "agents" component')
})

// A directory's own mtime moves only when an entry is added, removed or renamed — never when a file
// inside it is rewritten in place — so a rebuild that rewrites com.github.copilot/'s files leaves the
// directory looking as old as its first build (issue #144).
test('a rebuilt com.github.copilot/ is not stale even when the directory itself is older than plugin.json', () => {
	write(
		'plugin.json',
		`${JSON.stringify({
			$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
			name: 'demo',
			version: '1.0.0',
			description: 'a demo plugin',
			extensions: { 'org.cyberuni.universal-plugin': { vendors: ['copilot-cli'] } },
		})}\n`,
	)
	write('agents/reviewer.md', '---\nname: reviewer\ndescription: reviews\n---\nreview\n')
	const build = spawnSync('node', [path.resolve('bin/universal-plugin.mjs'), 'plugin', 'build', '--root', root], {
		encoding: 'utf8',
	})
	expect(build.status).toBe(0)
	const past = new Date(Date.now() - 60_000)
	fs.utimesSync(path.join(root, 'com.github.copilot'), past, past)

	const result = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	const report = JSON.parse(result.stdout) as {
		vendors: { vendor: string; stale: boolean }[]
		findings: { code: string }[]
	}
	expect(report.vendors.find((v) => v.vendor === 'copilot-cli')?.stale).toBe(false)
	expect(report.findings.map((f) => f.code)).not.toContain('stale')
})

test('a com.github.copilot/ whose files predate plugin.json is still stale', () => {
	write(
		'plugin.json',
		`${JSON.stringify({
			$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
			name: 'demo',
			version: '1.0.0',
			description: 'a demo plugin',
			extensions: { 'org.cyberuni.universal-plugin': { vendors: ['copilot-cli'] } },
		})}\n`,
	)
	write('agents/reviewer.md', '---\nname: reviewer\ndescription: reviews\n---\nreview\n')
	const build = spawnSync('node', [path.resolve('bin/universal-plugin.mjs'), 'plugin', 'build', '--root', root], {
		encoding: 'utf8',
	})
	expect(build.status).toBe(0)
	const past = new Date(Date.now() - 60_000)
	const touch = (abs: string) => {
		if (fs.statSync(abs).isDirectory()) for (const entry of fs.readdirSync(abs)) touch(path.join(abs, entry))
		fs.utimesSync(abs, past, past)
	}
	touch(path.join(root, 'com.github.copilot'))

	expect(findings()).toContain('stale')
})

test('a semantic-release placeholder is reported as unstamped, not as version-drift', () => {
	seedRelease('1.0.0')
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', '{ "name": "demo-cli", "version": "0.0.0-development" }\n')

	const codes = findings()
	expect(codes).toContain('unstamped')
	expect(codes).not.toContain('version-drift')
	expect(detail('unstamped')).toBe('package.json holds 0.0.0-development, which the release replaces')
})

test('a copied doctor script with no CLI beside it runs the pinned npx fallback', () => {
	// A copy, as pnpm's fallback makes: four levels up is not the package root.
	const copy = path.join(root, '.claude/skills/pnpm-universal-plugin-doctor/scripts/doctor.mjs')
	fs.mkdirSync(path.dirname(copy), { recursive: true })
	fs.copyFileSync(doctor, copy)
	const bin = path.join(root, 'fake-bin')
	fs.mkdirSync(bin)
	const log = path.join(root, 'npx.log')
	fs.writeFileSync(path.join(bin, 'npx'), `#!/bin/sh\necho "$@" >> ${log}\nexit 1\n`, { mode: 0o755 })
	// The project has no installed CLI either: `pnpm exec` finds nothing.
	fs.writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 })
	writeManifest('1.0.0')
	spawnSync('node', [copy, '--root', root], {
		encoding: 'utf8',
		env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
	})
	const own = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { version: string }
	const calls = fs.readFileSync(log, 'utf8').trim().split('\n')
	expect(calls.length).toBeGreaterThan(0)
	for (const call of calls) expect(call.startsWith(`universal-plugin@${own.version} `)).toBe(true)
})

test('a skill link that leaves the skill folder is a skill-link-escapes finding', () => {
	writeManifest('1.0.0')
	writeSkill('See [the readme](../../readme.md).')
	expect(findings()).toContain('skill-link-escapes')
})

function writeScriptManifest(version: string) {
	write(
		'plugin.json',
		`${JSON.stringify({
			$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
			name: 'demo',
			version,
			description: 'a demo plugin',
			extensions: {
				'org.cyberuni.universal-plugin': {
					vendors: ['claude-code'],
					scripts: { 'skills/demo/scripts/a.mjs': 'src/a.ts' },
				},
			},
		})}\n`,
	)
}

function buildRoot() {
	const r = spawnSync('node', [path.resolve('bin/universal-plugin.mjs'), 'plugin', 'build', '--root', root], {
		encoding: 'utf8',
	})
	expect(r.status).toBe(0)
}

test('a compiled script behind its source is a stale-script finding', () => {
	writeScriptManifest('1.0.0')
	writeSkill('demo')
	write('src/a.ts', 'console.log(1)\n')
	buildRoot()
	expect(findings()).not.toContain('stale-script')

	write('src/a.ts', 'console.log(2)\n')
	expect(findings()).toContain('stale-script')
})

test('a compiled script that was never compiled is a stale-script finding', () => {
	writeScriptManifest('1.0.0')
	writeSkill('demo')
	write('src/a.ts', 'console.log(1)\n')
	expect(detail('stale-script')).toContain('not compiled')
})

test('a compiled script on an old version is version drift, not also stale-script', () => {
	writeScriptManifest('1.0.0')
	writeSkill('demo')
	write('src/a.ts', 'console.log(1)\n')
	buildRoot()
	writeScriptManifest('1.1.0')
	// Rebuild the manifests but not the script: only its embedded version is behind.
	const script = fs.readFileSync(path.join(root, 'skills/demo/scripts/a.mjs'), 'utf8')
	buildRoot()
	fs.writeFileSync(path.join(root, 'skills/demo/scripts/a.mjs'), script)

	const codes = findings()
	expect(codes).not.toContain('stale-script')
	expect(codes.filter((c) => c === 'version-drift')).toEqual(['version-drift'])
})

// A plugin released with changesets but shipped to no npm package (#234): each gap below leaves the
// Version Packages PR merging with no tag and no release.
function seedChangesets(config: object) {
	seedRelease()
	write('.changeset/config.json', `${JSON.stringify(config)}\n`)
	write('package.json', '{ "name": "demo", "private": true, "version": "1.0.0" }\n')
}
const tagged = { privatePackages: { version: true, tag: true } }
const workflow = (step: string) =>
	`on: push\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: changesets/action@v2\n${step}`

test('a changesets repository whose plugin has no package.json is reported', () => {
	seedRelease()
	write('.changeset/config.json', `${JSON.stringify(tagged)}\n`)
	expect(findings()).toContain('changesets-no-package')
})

test('a private plugin package changesets would not tag is reported', () => {
	seedChangesets({ privatePackages: { version: true } })
	expect(detail('changesets-private-untagged')).toContain('"privatePackages": { "version": true, "tag": true }')
})

test('a changesets/action step with no publish script is reported, named by workflow', () => {
	seedChangesets(tagged)
	write('.github/workflows/release.yml', workflow('        with:\n          version-script: pnpm version\n'))
	expect(detail('changesets-no-publish-script')).toContain('.github/workflows/release.yml')
})

test('a fully configured non-npm changesets release reports no changesets finding', () => {
	seedChangesets(tagged)
	write('.github/workflows/release.yml', workflow('        with:\n          publish-script: pnpm release\n'))
	expect(findings().filter((code) => code.startsWith('changesets-'))).toEqual([])
})

test('an npm-shipped plugin is not checked for the private-package release config', () => {
	seedRelease()
	write('.changeset/config.json', '{}\n')
	write('package.json', '{ "name": "demo", "version": "1.0.0" }\n')
	write('.github/workflows/release.yml', workflow(''))
	expect(findings().filter((code) => code.startsWith('changesets-'))).toEqual([])
})

test('a repository without changesets reports no changesets finding', () => {
	seedRelease()
	expect(findings().filter((code) => code.startsWith('changesets-'))).toEqual([])
})

// A plugin released with release-please but shipped to no npm package (#238): extra-files bumps
// plugin.json and nothing restamps the rest unless a workflow runs plugin version.
const releasePlease = (extraFiles: unknown[]) => ({
	'release-type': 'simple',
	packages: { '.': { 'extra-files': extraFiles } },
})
const bumpsManifest = [{ type: 'json', path: 'plugin.json', jsonpath: '$.version' }]

test('a release-please config that bumps plugin.json with no restamp workflow is reported', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify(releasePlease(bumpsManifest))}\n`)
	write(
		'.github/workflows/release.yml',
		'on: push\njobs:\n  release:\n    steps:\n      - uses: googleapis/release-please-action@v5\n',
	)
	expect(detail('release-please-no-restamp')).toContain('no workflow runs plugin version')
})

test('a release-please setup with a restamp workflow reports no release-please finding', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify(releasePlease(['/plugin.json']))}\n`)
	write('.github/workflows/release.yml', 'steps:\n  - run: pnpm exec universal-plugin plugin version --from-manifest\n')
	expect(findings()).not.toContain('release-please-no-restamp')
})

test('a release-please config that does not bump plugin.json is not checked', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify(releasePlease([]))}\n`)
	expect(findings()).not.toContain('release-please-no-restamp')
})

test('top-level extra-files apply to a package that sets none', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify({ 'extra-files': bumpsManifest, packages: { '.': {} } })}\n`)
	expect(findings()).toContain('release-please-no-restamp')
})

// A plugin released with release-it (#237): release-it reads the version from the latest git tag and
// tags whatever the release commit holds, so a config with no hook running `plugin version` tags a
// release whose manifests still carry the previous number.
const stampHook = { 'after:bump': 'universal-plugin plugin version ${version}' }

test('a release-it config with no hook running plugin version is reported, named by file', () => {
	seedRelease()
	write('.release-it.json', `${JSON.stringify({ npm: false })}\n`)
	expect(detail('release-it-no-stamp')).toContain('.release-it.json')
})

test('a release-it config whose hook runs plugin version reports no release-it finding', () => {
	seedRelease()
	write('.release-it.json', `${JSON.stringify({ npm: false, hooks: stampHook })}\n`)
	expect(findings()).not.toContain('release-it-no-stamp')
})

test('a release-it config in a YAML file is read as text', () => {
	seedRelease()
	write('.release-it.yaml', 'npm: false\nhooks:\n  after:bump: npx universal-plugin plugin version ${version}\n')
	expect(findings()).not.toContain('release-it-no-stamp')
})

test('a release-it config in the package.json "release-it" key is checked', () => {
	seedRelease()
	write('package.json', `${JSON.stringify({ name: 'demo', private: true, 'release-it': { npm: false } })}\n`)
	expect(detail('release-it-no-stamp')).toContain('package.json')
})

test('a repository without release-it reports no release-it finding', () => {
	seedRelease()
	write('package.json', '{ "name": "demo", "private": true }\n')
	expect(findings()).not.toContain('release-it-no-stamp')
})

// A plugin released with semantic-release. Only an @semantic-release/exec prepareCmd running plugin
// version stamps the release's number before @semantic-release/git commits; a plugin that ships to
// no npm package must not run @semantic-release/npm.
const exec = [
	'@semantic-release/exec',
	// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release's own placeholder, written literally
	{ prepareCmd: 'npx universal-plugin@0.17.1 plugin version ${nextRelease.version}' },
]
const releaserc = (plugins: unknown[]) => `${JSON.stringify({ branches: ['main'], plugins }, null, 2)}\n`

test('a semantic-release config with no prepareCmd running plugin version is reported', () => {
	seedRelease()
	write('.releaserc.json', releaserc(['@semantic-release/commit-analyzer', '@semantic-release/git']))
	expect(detail('semantic-release-no-stamp')).toContain('.releaserc.json')
})

test('plugin version run outside prepareCmd does not count as the stamp', () => {
	seedRelease()
	write(
		'.releaserc.json',
		// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release's own placeholder, written literally
		releaserc([['@semantic-release/exec', { publishCmd: 'universal-plugin plugin version ${nextRelease.version}' }]]),
	)
	expect(findings()).toContain('semantic-release-no-stamp')
})

test('the wiring the init skill writes for a non-npm plugin reports no semantic-release finding', () => {
	seedRelease()
	write(
		'.releaserc.json',
		releaserc([
			'@semantic-release/commit-analyzer',
			exec,
			['@semantic-release/git', { assets: ['plugin.json'] }],
			'@semantic-release/github',
		]),
	)
	expect(findings().filter((code) => code.startsWith('semantic-release-'))).toEqual([])
})

test('a YAML prepareCmd written as a block scalar counts as the stamp', () => {
	seedRelease()
	write(
		'.releaserc.yml',
		// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release's own placeholder, written literally
		'plugins:\n  - - "@semantic-release/exec"\n    - prepareCmd: >-\n        universal-plugin plugin version ${nextRelease.version}\n',
	)
	expect(findings()).not.toContain('semantic-release-no-stamp')
})

test('a non-npm plugin whose semantic-release config lists @semantic-release/npm is reported', () => {
	seedRelease()
	write('release.config.mjs', `export default ${releaserc(['@semantic-release/npm', exec])}`)
	expect(detail('semantic-release-npm-unshipped')).toContain('release.config.mjs')
	expect(findings()).not.toContain('semantic-release-no-stamp')
})

test('a non-npm plugin relying on the default plugins list is reported, since the defaults run npm', () => {
	seedRelease()
	write('package.json', `${JSON.stringify({ name: 'demo', private: true, release: { branches: ['main'] } })}\n`)
	expect(detail('semantic-release-npm-unshipped')).toContain('package.json')
	expect(findings()).toContain('semantic-release-no-stamp')
})

test('an npm-shipped plugin may keep @semantic-release/npm', () => {
	seedRelease()
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', `${JSON.stringify({ name: 'demo', version: '1.0.0' })}\n`)
	write('.releaserc.json', releaserc(['@semantic-release/npm', exec, '@semantic-release/git']))
	expect(findings().filter((code) => code.startsWith('semantic-release-'))).toEqual([])
})

test('a semantic-release config that extends a shareable config is not checked', () => {
	seedRelease()
	write('.releaserc.json', `${JSON.stringify({ extends: '@acme/semantic-release-config' })}\n`)
	expect(findings().filter((code) => code.startsWith('semantic-release-'))).toEqual([])
})

test('only the first config semantic-release finds is read', () => {
	seedRelease()
	write('.releaserc.json', releaserc([exec, '@semantic-release/git']))
	write('release.config.js', 'module.exports = { plugins: ["@semantic-release/npm"] }\n')
	expect(findings().filter((code) => code.startsWith('semantic-release-'))).toEqual([])
})

test('a repository without semantic-release reports no semantic-release finding', () => {
	seedRelease()
	expect(findings().filter((code) => code.startsWith('semantic-release-'))).toEqual([])
})

// A restamp pushed with the default GITHUB_TOKEN starts no workflow run, so the release PR's checks
// never run on its head commit. A workflow dispatch does not fix it, since its checks do not count
// toward a required check; a token that starts runs does.
const restampWorkflow = (extra: string) =>
	[
		'on: push',
		'permissions:',
		'  contents: write',
		'jobs:',
		'  release-please:',
		'    steps:',
		'      - id: release',
		'        uses: googleapis/release-please-action@v5',
		'      - uses: actions/checkout@v7',
		extra,
		'      - run: |',
		'          npx -y universal-plugin plugin version --from-manifest',
		'          git push',
		'',
	].join('\n')

test('a restamp pushed with the default token and no dispatch is reported', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify(releasePlease(bumpsManifest))}\n`)
	write('.github/workflows/release.yml', restampWorkflow('        with:\n          token: ${{ secrets.GITHUB_TOKEN }}'))
	expect(findings()).not.toContain('release-please-no-restamp')
	expect(detail('release-please-restamp-no-ci')).toContain('.github/workflows/release.yml')
})

test('a restamp that dispatches CI after a default-token push is still reported', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify(releasePlease(bumpsManifest))}\n`)
	write('.github/workflows/release.yml', `${restampWorkflow('')}      - run: gh workflow run ci.yml --ref "$BRANCH"\n`)
	expect(findings()).toContain('release-please-restamp-no-ci')
})

test('a restamp that pushes with a GitHub App token is not reported', () => {
	seedRelease()
	write('release-please-config.json', `${JSON.stringify(releasePlease(bumpsManifest))}\n`)
	write(
		'.github/workflows/release.yml',
		restampWorkflow('        with:\n          token: ${{ steps.app.outputs.token }}'),
	)
	expect(findings()).not.toContain('release-please-restamp-no-ci')
})

// The stamped files reach the release tag only through a commit made during prepare, and prepare
// steps run in plugins list order: @semantic-release/git must exist and come after the exec stamp.
test('a semantic-release config that stamps but runs no @semantic-release/git is reported', () => {
	seedRelease()
	write('.releaserc.json', releaserc(['@semantic-release/commit-analyzer', exec, '@semantic-release/github']))
	expect(detail('semantic-release-no-commit')).toContain('.releaserc.json')
	expect(findings()).not.toContain('semantic-release-git-before-exec')
})

test('an npm-shipped plugin with no @semantic-release/git is reported at medium severity', () => {
	seedRelease()
	write('.agents/universal-plugin.json', '{ "packagePath": "." }\n')
	write('package.json', `${JSON.stringify({ name: 'demo', version: '1.0.0' })}\n`)
	write('.releaserc.json', releaserc(['@semantic-release/npm', exec]))
	const result = spawnSync('node', [doctor, '--root', root], { encoding: 'utf8' })
	const report = JSON.parse(result.stdout) as { findings: { code: string; severity: string; detail: string }[] }
	const finding = report.findings.find((f) => f.code === 'semantic-release-no-commit')
	expect(finding?.severity).toBe('medium')
	expect(finding?.detail).toContain('npm package')
})

test('a prepareCmd that commits the stamped files itself counts as the commit', () => {
	seedRelease()
	write(
		'.releaserc.json',
		releaserc([
			[
				'@semantic-release/exec',
				// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release's own placeholder, written literally
				{ prepareCmd: 'universal-plugin plugin version ${nextRelease.version} && git commit -am release' },
			],
		]),
	)
	expect(findings()).not.toContain('semantic-release-no-commit')
})

test('@semantic-release/git listed before the exec stamp is reported', () => {
	seedRelease()
	write('.releaserc.json', releaserc([['@semantic-release/git', { assets: ['plugin.json'] }], exec]))
	expect(detail('semantic-release-git-before-exec')).toContain('.releaserc.json')
	expect(findings()).not.toContain('semantic-release-no-commit')
})

test('@semantic-release/git listed before the exec stamp in YAML is reported', () => {
	seedRelease()
	write(
		'.releaserc.yml',
		// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release's own placeholder, written literally
		'plugins:\n  - "@semantic-release/git"\n  - - "@semantic-release/exec"\n    - prepareCmd: universal-plugin plugin version ${nextRelease.version}\n',
	)
	expect(findings()).toContain('semantic-release-git-before-exec')
})

test('@semantic-release/github is not mistaken for @semantic-release/git', () => {
	seedRelease()
	write('.releaserc.json', releaserc(['@semantic-release/github', exec]))
	expect(findings()).toContain('semantic-release-no-commit')
	expect(findings()).not.toContain('semantic-release-git-before-exec')
})

test('the plugin order of a JavaScript config is not checked', () => {
	seedRelease()
	write('release.config.mjs', `export default ${releaserc(['@semantic-release/git', exec])}`)
	expect(findings()).not.toContain('semantic-release-git-before-exec')
})

test('a config with a top-level prepare key is not checked for plugin order', () => {
	seedRelease()
	write(
		'.releaserc.json',
		`${JSON.stringify({ plugins: ['@semantic-release/git', exec], prepare: [{ path: '@semantic-release/exec' }, { path: '@semantic-release/git' }] }, null, 2)}\n`,
	)
	expect(findings()).not.toContain('semantic-release-git-before-exec')
})

test('reports an object repository codex reads from the canonical manifest as unaccepted-metadata', () => {
	write(
		'plugin.json',
		`${JSON.stringify(
			{
				$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
				name: 'demo',
				version: '1.0.0',
				description: 'a demo plugin',
				repository: { type: 'git', url: 'https://github.com/a/b' },
				extensions: { 'org.cyberuni.universal-plugin': { vendors: ['codex'] } },
			},
			null,
			2,
		)}\n`,
	)
	commit('a plugin codex will not load')

	expect(findings()).toContain('unaccepted-metadata')
	expect(detail('unaccepted-metadata')).toContain('write repository as the URL string in plugin.json')
})
