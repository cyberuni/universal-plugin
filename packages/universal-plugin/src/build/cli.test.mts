import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')

let repo: string
let workspacePackage: string

// A pnpm monorepo with one workspace package that carries the plugin manifest — the shape from the
// bug report: `packages/pods` holds plugin.json, and the build runs from inside it.
beforeEach(() => {
	repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-buildcli-')))
	workspacePackage = path.join(repo, 'packages', 'pods')
	fs.mkdirSync(workspacePackage, { recursive: true })
	fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
	fs.writeFileSync(
		path.join(workspacePackage, 'plugin.json'),
		`${JSON.stringify(
			{
				name: 'pods',
				version: '1.0.0',
				description: 'a workspace plugin',
				extensions: { 'org.cyberuni.universal-plugin': { harnesses: { 'claude-code': {} } } },
			},
			null,
			'\t',
		)}\n`,
	)
})
afterEach(() => {
	fs.rmSync(repo, { recursive: true, force: true })
})

function build(...args: string[]) {
	return spawnSync('node', [bin, 'plugin', 'build', ...args], {
		cwd: workspacePackage,
		encoding: 'utf8',
		env: { ...process.env, NODE_NO_WARNINGS: '1' },
	})
}

const built = () => fs.existsSync(path.join(workspacePackage, '.claude-plugin/plugin.json'))

test('builds from a workspace package cwd with no --root', () => {
	const r = build()
	expect(r.stderr).not.toMatch(/No plugin.json found/)
	expect(r.status).toBe(0)
	expect(built()).toBe(true)
})

test('builds from a workspace package cwd with --root .', () => {
	const r = build('--root', '.')
	expect(r.stderr).not.toMatch(/No plugin.json found/)
	expect(r.status).toBe(0)
	expect(built()).toBe(true)
})

// The reported failure: the workspace-relative path was joined onto a cwd already inside it, so
// the build looked for <repo>/packages/pods/packages/pods/plugin.json.
test('does not double a workspace-relative --root given from inside that package', () => {
	const r = build('--root', 'packages/pods')
	expect(r.stderr).not.toMatch(/packages[/\\]pods[/\\]packages[/\\]pods/)
	expect(r.status).toBe(0)
	expect(built()).toBe(true)
})

test('reports the absolute directory it searched when the manifest is missing', () => {
	const empty = path.join(repo, 'packages', 'empty')
	fs.mkdirSync(empty, { recursive: true })
	const r = build('--root', path.relative(workspacePackage, empty))
	expect(r.status).toBe(1)
	expect(r.stderr).toContain(`No plugin.json found at ${empty}`)
})

// A build re-derives this plugin's entry in the repository catalogs the repository already carries,
// so the entry version follows the manifest instead of drifting (ADR-0010 §3).
test('refreshes the repository catalog entry and reports it', () => {
	spawnSync('git', ['-C', repo, 'init', '-q'])
	fs.mkdirSync(path.join(repo, '.claude-plugin'), { recursive: true })
	fs.writeFileSync(
		path.join(repo, '.claude-plugin', 'marketplace.json'),
		`${JSON.stringify(
			{
				name: 'pan-repo-local',
				owner: { name: 'pan' },
				plugins: [{ name: 'pods', source: './packages/pods', version: '0.1.0' }],
			},
			null,
			2,
		)}\n`,
	)

	const r = build('--json')
	expect(r.status).toBe(0)
	expect(JSON.parse(r.stdout).catalogs).toEqual([{ path: '.claude-plugin/marketplace.json', status: 'updated' }])
	const catalog = JSON.parse(fs.readFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'))
	expect(catalog.plugins[0]).toMatchObject({ name: 'pods', source: './packages/pods', version: '1.0.0' })
	expect(catalog.owner).toEqual({ name: 'pan' })
})

// ── issue #61: deriving nothing is reported by cause ──

function writeWorkspaceManifest(manifest: object) {
	fs.writeFileSync(path.join(workspacePackage, 'plugin.json'), `${JSON.stringify(manifest, null, '\t')}\n`)
}

// Scenario: the definitive empty state names doctor as the next step
test('a canonical manifest declaring no harnesses stays exit 0 and points at doctor', () => {
	writeWorkspaceManifest({ name: 'pods', version: '1.0.0', description: 'a workspace plugin' })
	const r = build()
	expect(r.status).toBe(0)
	expect(r.stderr).toMatch(/nothing to build/)
	expect(r.stderr).toMatch(/\/universal-plugin:doctor/)
	expect(built()).toBe(false)
})

// Scenario: a pre-0.6 vendorExtensions block that derives nothing fails loud
test('a top-level vendorExtensions block that derives nothing exits 1 naming the signal', () => {
	writeWorkspaceManifest({ name: 'pods', version: '1.0.0', vendorExtensions: { 'claude-code': {} } })
	const r = build()
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/vendorExtensions/)
	expect(r.stderr).toMatch(/\/universal-plugin:doctor/)
	expect(built()).toBe(false)
})

// Scenario: a shadowing .plugin/plugin.json that derives nothing fails loud
test('a shadowing .plugin/plugin.json that derives nothing exits 1 naming the signal', () => {
	writeWorkspaceManifest({ name: 'pods', version: '1.0.0', description: 'a workspace plugin' })
	fs.mkdirSync(path.join(workspacePackage, '.plugin'), { recursive: true })
	fs.writeFileSync(path.join(workspacePackage, '.plugin/plugin.json'), '{"name":"pods"}\n')
	const r = build()
	expect(r.status).toBe(1)
	expect(r.stderr).toMatch(/\.plugin\/plugin\.json/)
	expect(r.stderr).toMatch(/\/universal-plugin:doctor/)
	expect(built()).toBe(false)
})

// Scenario: a pre-0.6 signal beside harnesses that still derive is not a build failure
test('a shadowing .plugin/plugin.json beside deriving harnesses is not a build failure', () => {
	fs.mkdirSync(path.join(workspacePackage, '.plugin'), { recursive: true })
	fs.writeFileSync(path.join(workspacePackage, '.plugin/plugin.json'), '{"name":"pods"}\n')
	const r = build()
	expect(r.status).toBe(0)
	expect(built()).toBe(true)
})
