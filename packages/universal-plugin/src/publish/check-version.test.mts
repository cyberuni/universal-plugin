import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

/** `publish check-version` is the CI gate for issue #164: on a release PR it fails when a release
 *  moved one version-carrying file and left the rest behind. The repository is a git fixture so the
 *  catalogs at its root are found the way `plugin build` finds them. */
const bin = path.resolve('bin/universal-plugin.mjs')

let repo: string

beforeEach(() => {
	repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-checkversion-')))
	spawnSync('git', ['-C', repo, 'init', '-q'])
})
afterEach(() => {
	fs.rmSync(repo, { recursive: true, force: true })
})

function run(root: string, ...args: string[]) {
	return spawnSync('node', [bin, 'publish', 'check-version', '--root', root, ...args], {
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

function writeJson(rel: string, value: unknown) {
	const target = path.join(repo, rel)
	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, `${JSON.stringify(value, null, '\t')}\n`)
}

function write(rel: string, content: string) {
	const target = path.join(repo, rel)
	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, content)
}

/** The issue's layout: a monorepo plugin shipped by a package beside it, with a repository catalog. */
function seedMonorepo(versions: { pkg: string; manifest: string; claude: string; catalog: string; pin: string }) {
	writeJson('packages/demo/package.json', { name: 'demo-cli', version: versions.pkg })
	writeJson('plugins/demo/.agents/universal-plugin.json', { packagePath: '../../packages/demo' })
	writeJson('plugins/demo/plugin.json', {
		$schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
		name: 'demo',
		version: versions.manifest,
		extensions: { 'org.cyberuni.universal-plugin': { vendors: ['claude-code'] } },
	})
	writeJson('plugins/demo/.claude-plugin/plugin.json', { name: 'demo', version: versions.claude })
	writeJson('.claude-plugin/marketplace.json', {
		name: 'mkt',
		owner: { name: 'me' },
		plugins: [{ name: 'demo', source: './plugins/demo', version: versions.catalog }],
	})
	write('plugins/demo/skills/demo/SKILL.md', `---\nname: demo\n---\n\nRun \`npx --yes demo-cli@${versions.pin} go\`.\n`)
}

test('every file agreeing exits 0', () => {
	seedMonorepo({ pkg: '0.9.0', manifest: '0.9.0', claude: '0.9.0', catalog: '0.9.0', pin: '0.9.0' })
	const r = run(path.join(repo, 'plugins/demo'), '--format', 'json')
	expect(r.status).toBe(0)
	const out = JSON.parse(r.stdout)
	expect(out).toMatchObject({ ok: true, expected: '0.9.0', drifted: [] })
	expect(out.surfaces).toHaveLength(5)
})

test('a release that moved only package.json fails and names every file left behind', () => {
	seedMonorepo({ pkg: '0.9.0', manifest: '0.8.0', claude: '0.8.0', catalog: '0.8.0', pin: '0.8.0' })
	const r = run(path.join(repo, 'plugins/demo'), '--format', 'json')
	expect(r.status).toBe(1)
	const out = JSON.parse(r.stdout)
	expect(out.ok).toBe(false)
	expect(out.source).toBe('../../packages/demo/package.json')
	expect(out.drifted.map((d: { path: string }) => d.path)).toEqual([
		'plugin.json',
		'.claude-plugin/plugin.json',
		'../../.claude-plugin/marketplace.json',
		'skills/demo/SKILL.md',
	])
	expect(r.stderr).toContain('plugin.json is 0.8.0, ../../packages/demo/package.json is 0.9.0')
	expect(r.stderr).toMatch(/→ universal-plugin publish sync-version\n$/)
})

test('only the skill pin left behind points at plugin bundle', () => {
	seedMonorepo({ pkg: '0.9.0', manifest: '0.9.0', claude: '0.9.0', catalog: '0.9.0', pin: '0.8.0' })
	const r = run(path.join(repo, 'plugins/demo'))
	expect(r.status).toBe(1)
	expect(r.stdout).toContain('skills/demo/SKILL.md')
	expect(r.stderr).toMatch(/→ universal-plugin plugin bundle\n$/)
})

test('without packagePath the canonical manifest is the reference', () => {
	writeJson('plugin.json', {
		name: 'demo',
		version: '1.0.0',
		extensions: { 'org.cyberuni.universal-plugin': { vendors: ['claude-code'] } },
	})
	writeJson('.claude-plugin/plugin.json', { name: 'demo', version: '0.9.0' })
	const r = run(repo)
	expect(r.status).toBe(1)
	expect(r.stderr).toContain('.claude-plugin/plugin.json is 0.9.0, plugin.json is 1.0.0')
	expect(r.stderr).toMatch(/→ universal-plugin plugin build\n$/)
})

test('a missing plugin.json fails loud', () => {
	const r = run(repo)
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/No plugin.json found/)
})
