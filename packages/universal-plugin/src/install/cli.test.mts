import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')

let sandbox: string
let plugin: string
let home: string
let claudeDir: string
let cursorDir: string

// The vendor registry reads a user override from `$HOME/.agents/universal-plugin-vendors.json`, so
// pointing HOME at a sandbox redirects every local plugin directory into it. Nothing here touches
// the real runtimes.
beforeEach(() => {
	sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-install-')))
	plugin = path.join(sandbox, 'my-plugin')
	home = path.join(sandbox, 'home')
	claudeDir = path.join(home, 'claude-skills')
	cursorDir = path.join(home, 'cursor-local')
	fs.mkdirSync(path.join(plugin, 'skills'), { recursive: true })
	fs.mkdirSync(path.join(home, '.agents'), { recursive: true })

	fs.writeFileSync(
		path.join(plugin, 'plugin.json'),
		`${JSON.stringify(
			{
				name: 'my-plugin',
				version: '1.0.0',
				description: 'a plugin under development',
				extensions: {
					'org.cyberuni.universal-plugin': { harnesses: { 'claude-code': {}, cursor: {}, codex: {} } },
				},
			},
			null,
			'\t',
		)}\n`,
	)
	fs.writeFileSync(
		path.join(home, '.agents', 'universal-plugin-vendors.json'),
		JSON.stringify({
			'claude-code': { localPluginDir: claudeDir, localPluginLink: true },
			cursor: { localPluginDir: cursorDir, localPluginLink: false },
		}),
	)
	run('plugin', 'build')
})
afterEach(() => {
	fs.rmSync(sandbox, { recursive: true, force: true })
})

function run(...args: string[]) {
	return spawnSync('node', [bin, ...args], {
		cwd: plugin,
		encoding: 'utf8',
		env: { ...process.env, HOME: home, USERPROFILE: home, NODE_NO_WARNINGS: '1' },
	})
}

const claudeDest = () => path.join(claudeDir, 'my-plugin')
const cursorDest = () => path.join(cursorDir, 'my-plugin')

test('links the plugin root into a vendor that loads an out-of-tree symlink', () => {
	const r = run('plugin', 'install', '--vendor', 'claude-code')
	expect(r.status).toBe(0)
	expect(fs.lstatSync(claudeDest()).isSymbolicLink()).toBe(true)
	expect(fs.realpathSync(claudeDest())).toBe(plugin)
})

test('copies into a vendor that rejects an out-of-tree symlink', () => {
	const r = run('plugin', 'install', '--vendor', 'cursor')
	expect(r.status).toBe(0)
	expect(fs.lstatSync(cursorDest()).isSymbolicLink()).toBe(false)
	expect(fs.existsSync(path.join(cursorDest(), 'plugin.json'))).toBe(true)
})

test('a copy leaves node_modules and .git behind', () => {
	fs.mkdirSync(path.join(plugin, 'node_modules', 'left-behind'), { recursive: true })
	fs.mkdirSync(path.join(plugin, '.git'), { recursive: true })
	run('plugin', 'install', '--vendor', 'cursor')
	expect(fs.existsSync(path.join(cursorDest(), 'node_modules'))).toBe(false)
	expect(fs.existsSync(path.join(cursorDest(), '.git'))).toBe(false)
})

test('defaults to every vendor the manifest declares', () => {
	const r = run('plugin', 'install', '--format', 'json')
	expect(r.status).toBe(0)
	const result = JSON.parse(r.stdout) as { rows: { vendor: string; action: string }[] }
	expect(result.rows.map((row) => row.vendor)).toEqual(['claude-code', 'cursor', 'codex'])
	expect(result.rows.find((row) => row.vendor === 'codex')?.action).toBe('unsupported')
})

test('re-running changes nothing and stays green', () => {
	run('plugin', 'install', '--vendor', 'claude-code')
	const r = run('plugin', 'install', '--vendor', 'claude-code', '--format', 'json')
	expect(r.status).toBe(0)
	expect((JSON.parse(r.stdout) as { rows: { action: string }[] }).rows[0]?.action).toBe('unchanged')
})

test('--list resolves the destinations without writing', () => {
	const r = run('plugin', 'install', '--vendor', 'claude-code', '--list')
	expect(r.status).toBe(0)
	expect(r.stdout).toContain(claudeDest())
	expect(fs.existsSync(claudeDest())).toBe(false)
})

test('a destination holding another plugin is refused, and left alone', () => {
	fs.mkdirSync(claudeDest(), { recursive: true })
	fs.writeFileSync(path.join(claudeDest(), 'plugin.json'), JSON.stringify({ name: 'someone-else' }))
	const r = run('plugin', 'install', '--vendor', 'claude-code')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--force/)
	expect(JSON.parse(fs.readFileSync(path.join(claudeDest(), 'plugin.json'), 'utf8')).name).toBe('someone-else')
})

test('--force replaces a destination this plugin does not own', () => {
	fs.mkdirSync(claudeDest(), { recursive: true })
	fs.writeFileSync(path.join(claudeDest(), 'plugin.json'), JSON.stringify({ name: 'someone-else' }))
	const r = run('plugin', 'install', '--vendor', 'claude-code', '--force')
	expect(r.status).toBe(0)
	expect(fs.realpathSync(claudeDest())).toBe(plugin)
})

test('--link fails a vendor that will not load one, naming --copy', () => {
	const r = run('plugin', 'install', '--vendor', 'cursor', '--link')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/--copy/)
	expect(fs.existsSync(cursorDest())).toBe(false)
})

test('a missing derived manifest fails loudly, naming plugin build', () => {
	fs.rmSync(path.join(plugin, '.claude-plugin'), { recursive: true, force: true })
	const r = run('plugin', 'install', '--vendor', 'claude-code')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/plugin build/)
	expect(fs.existsSync(claudeDest())).toBe(false)
})

test('a vendor the manifest does not declare fails', () => {
	const r = run('plugin', 'install', '--vendor', 'copilot-cli')
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/not declared/)
})

test('--copy snapshots even where a symlink would load', () => {
	const r = run('plugin', 'install', '--vendor', 'claude-code', '--copy')
	expect(r.status).toBe(0)
	expect(fs.lstatSync(claudeDest()).isSymbolicLink()).toBe(false)
	expect(fs.existsSync(path.join(claudeDest(), 'plugin.json'))).toBe(true)
})

test('an earlier install of this plugin is replaced, not stacked', () => {
	run('plugin', 'install', '--vendor', 'claude-code', '--copy')
	fs.writeFileSync(path.join(claudeDest(), 'stale.txt'), 'from the last install')
	const r = run('plugin', 'install', '--vendor', 'claude-code', '--copy')
	expect(r.status).toBe(0)
	expect(fs.existsSync(path.join(claudeDest(), 'stale.txt'))).toBe(false)
})

test('a successful run prints a TOON row per vendor plus the aggregate', () => {
	const r = run('plugin', 'install', '--vendor', 'claude-code')
	expect(r.stdout).toMatch(/vendors\[1\]\{vendor,path,action\}/)
	expect(r.stdout).toMatch(/summary: .*installed 1/)
})

test('the run names the reload step each vendor now needs', () => {
	const r = run('plugin', 'install', '--vendor', 'claude-code')
	expect(r.stderr).toMatch(/claude-code:/)
})

test('uninstall removes what install put there', () => {
	run('plugin', 'install', '--vendor', 'claude-code', '--vendor', 'cursor')
	const r = run('plugin', 'uninstall', '--vendor', 'claude-code', '--vendor', 'cursor')
	expect(r.status).toBe(0)
	expect(fs.existsSync(claudeDest())).toBe(false)
	expect(fs.existsSync(cursorDest())).toBe(false)
})

test('uninstall removes a copied install', () => {
	run('plugin', 'install', '--vendor', 'cursor')
	const r = run('plugin', 'uninstall', '--vendor', 'cursor')
	expect(r.status).toBe(0)
	expect(fs.existsSync(cursorDest())).toBe(false)
})

test('uninstall does not require a derived manifest', () => {
	run('plugin', 'install', '--vendor', 'claude-code')
	fs.rmSync(path.join(plugin, '.claude-plugin'), { recursive: true, force: true })
	const r = run('plugin', 'uninstall', '--vendor', 'claude-code')
	expect(r.status).toBe(0)
	expect(fs.existsSync(claudeDest())).toBe(false)
})

test('--force removes a destination this plugin does not own', () => {
	fs.mkdirSync(claudeDest(), { recursive: true })
	fs.writeFileSync(path.join(claudeDest(), 'plugin.json'), JSON.stringify({ name: 'someone-else' }))
	const r = run('plugin', 'uninstall', '--vendor', 'claude-code', '--force')
	expect(r.status).toBe(0)
	expect(fs.existsSync(claudeDest())).toBe(false)
})

test('--help prints a concise reference', () => {
	const r = run('plugin', 'install', '--help')
	expect(r.status).toBe(0)
	expect(r.stdout).toContain('--vendor')
	expect(r.stdout).toContain('Example:')
})

test('uninstalling twice reports the destination as missing rather than failing', () => {
	run('plugin', 'install', '--vendor', 'claude-code')
	run('plugin', 'uninstall', '--vendor', 'claude-code')
	const r = run('plugin', 'uninstall', '--vendor', 'claude-code', '--format', 'json')
	expect(r.status).toBe(0)
	expect((JSON.parse(r.stdout) as { rows: { action: string }[] }).rows[0]?.action).toBe('missing')
})

test('uninstall never removes another plugin', () => {
	fs.mkdirSync(claudeDest(), { recursive: true })
	fs.writeFileSync(path.join(claudeDest(), 'plugin.json'), JSON.stringify({ name: 'someone-else' }))
	const r = run('plugin', 'uninstall', '--vendor', 'claude-code')
	expect(r.status).toBe(1)
	expect(fs.existsSync(claudeDest())).toBe(true)
})

test('uninstall --list removes nothing', () => {
	run('plugin', 'install', '--vendor', 'claude-code')
	const r = run('plugin', 'uninstall', '--vendor', 'claude-code', '--list')
	expect(r.status).toBe(0)
	expect(fs.existsSync(claudeDest())).toBe(true)
})
