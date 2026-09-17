import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')
let root: string

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-marketplace-cli-'))
	fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ author: 'unional' }))
	fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
	fs.writeFileSync(
		path.join(root, 'plugins', 'alpha', 'plugin.json'),
		JSON.stringify({ name: 'alpha', version: '1.0.0' }),
	)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

function run(...args: string[]) {
	return spawnSync('node', [bin, 'marketplace', 'init', ...args, '--root', root], {
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

test('default command reports selected targets in TOON and local-only diagnostics', () => {
	const result = run()
	expect(result.status).toBe(0)
	expect(result.stdout).toMatch(/claude/)
	expect(result.stdout).toMatch(/cursor/)
	expect(result.stderr).toMatch(/no marketplace publication/i)
})

test('selector union, JSON output, dry-run, and force are observable through the CLI', () => {
	const preview = run('--claude', '--cursor', '--dry-run', '--format', 'json')
	expect(preview.status).toBe(0)
	expect(JSON.parse(preview.stdout)).toMatchObject([
		{ target: 'claude', status: 'planned' },
		{ target: 'cursor', status: 'planned' },
	])
	expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)

	const generated = run('--claude')
	expect(generated.status).toBe(0)
	fs.writeFileSync(path.join(root, '.claude-plugin/marketplace.json'), '{}\n')
	expect(run('--claude').status).toBe(1)
	expect(run('--claude').stderr).toMatch(/--force/)
	expect(run('--claude', '--force').status).toBe(0)
})

test('rejects output formats other than toon and json', () => {
	const result = run('--format', 'yaml')
	expect(result.status).toBe(1)
	expect(result.stderr).toMatch(/--format.*toon.*json/i)
})

function runValidate(...args: string[]) {
	return spawnSync('node', [bin, 'marketplace', 'validate', ...args, '--root', root], {
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

test('validate reports generated catalogs as valid and names the key in a broken one', () => {
	run('--claude')
	const ok = runValidate('--claude', '--format', 'json')
	expect(ok.status).toBe(0)
	expect(JSON.parse(ok.stdout)).toMatchObject([{ target: 'claude', status: 'valid', issues: [] }])

	const catalog = path.join(root, '.claude-plugin/marketplace.json')
	const broken = JSON.parse(fs.readFileSync(catalog, 'utf8'))
	broken.owner = 'Ari Vance'
	fs.writeFileSync(catalog, JSON.stringify(broken, null, 2))

	const failed = runValidate('--claude')
	expect(failed.status).toBe(1)
	expect(failed.stderr).toMatch(/owner must be an object with a name/)
})

test('validate treats an absent catalog as missing, or as a failure under --required', () => {
	expect(runValidate('--cursor').status).toBe(0)
	expect(runValidate('--cursor').stdout).toMatch(/missing/)
	expect(runValidate('--cursor', '--required').status).toBe(1)
})

function runAdd(...args: string[]) {
	return spawnSync('node', [bin, 'marketplace', 'add', ...args, '--root', root], {
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

test('add lists a plugin the repository does not hold, and says what it skipped and why', () => {
	const result = runAdd('npm:repobuddy', '--description', 'Repo automation', '--version', '1.4.0')
	expect(result.status).toBe(0)
	expect(result.stdout).toMatch(/repobuddy/)
	expect(result.stderr).toMatch(/skipped copilot: npm source is not supported/)
	expect(result.stderr).toMatch(/no marketplace publication/i)

	const catalog = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf8'))
	expect(catalog.plugins).toContainEqual({
		name: 'repobuddy',
		source: { source: 'npm', package: 'repobuddy' },
		description: 'Repo automation',
		version: '1.4.0',
	})
})

test('add reports rows as JSON, previews with --dry-run, and guards a replacement', () => {
	const preview = runAdd('cyberuni/universal-plugin', '--claude', '--dry-run', '--format', 'json')
	expect(preview.status).toBe(0)
	expect(JSON.parse(preview.stdout)).toMatchObject([{ target: 'claude', status: 'planned', entry: 'universal-plugin' }])
	expect(preview.stderr).toMatch(/Planned repository metadata only/)
	expect(fs.existsSync(path.join(root, '.claude-plugin/marketplace.json'))).toBe(false)

	expect(runAdd('npm:alpha', '--claude', '--name', 'alpha').status).toBe(0)
	const conflict = runAdd('cyberuni/alpha', '--claude', '--name', 'alpha')
	expect(conflict.status).toBe(1)
	expect(conflict.stderr).toMatch(/already listed differently/)
	expect(runAdd('cyberuni/alpha', '--claude', '--name', 'alpha', '--force').status).toBe(0)
})

test('add refuses a spec it cannot read and names the flags that settle it', () => {
	const unreadable = runAdd('not a spec', '--claude')
	expect(unreadable.status).toBe(1)
	expect(unreadable.stderr).toMatch(/--path, --npm, --github, --url, or --from-marketplace/)

	const twoKinds = runAdd('repobuddy', '--claude', '--npm', '--github')
	expect(twoKinds.status).toBe(1)
	expect(twoKinds.stderr).toMatch(/pass one source kind/)
})
