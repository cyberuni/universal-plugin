import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { realPrepareFs } from './fs.js'

let home: string
const environment = () => ({ homedir: home, env: {}, platform: 'linux' as const })

function write(file: string, content: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true })
	fs.writeFileSync(file, JSON.stringify(content))
}

beforeEach(() => {
	home = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-fs-'))
})

afterEach(() => {
	fs.rmSync(home, { recursive: true, force: true })
})

describe('realPrepareFs', () => {
	it('reads Claude Code user installs from its install record', () => {
		const installPath = path.join(home, '.claude/plugins/cache/mkt/cyber-github/1.2.0')
		write(path.join(home, '.claude/plugins/installed_plugins.json'), {
			version: 2,
			plugins: { 'cyber-github@mkt': [{ scope: 'user', installPath, version: '1.2.0' }] },
		})
		const prepareFs = realPrepareFs('claude-code', { scope: 'global' }, environment())
		expect(prepareFs.readManifest()).toEqual({ 'cyber-github': '1.2.0' })
		expect(prepareFs.readPluginRoots()).toEqual({ 'cyber-github': '~/.claude/plugins/cache/mkt/cyber-github/1.2.0' })
	})

	it('reads Copilot CLI installs from its installed-plugins folders', () => {
		write(path.join(home, '.copilot/installed-plugins/mkt/cyber-github/plugin.json'), {
			name: 'cyber-github',
			version: '2.0.0',
		})
		write(path.join(home, '.copilot/installed-plugins/_direct/abc123/.claude-plugin/plugin.json'), {
			name: 'direct-one',
		})
		const prepareFs = realPrepareFs('copilot-cli', { scope: 'global' }, environment())
		expect(prepareFs.readManifest()).toEqual({ 'cyber-github': '2.0.0', 'direct-one': 'unknown' })
		expect(prepareFs.readPluginRoots()['direct-one']).toBe('~/.copilot/installed-plugins/_direct/abc123')
	})

	it('reads the newest cached version of each Codex plugin', () => {
		for (const v of ['1.9.0', '1.10.0'])
			fs.mkdirSync(path.join(home, `.codex/plugins/cache/mkt/aced/${v}`), { recursive: true })
		const prepareFs = realPrepareFs('codex', { scope: 'global' }, environment())
		expect(prepareFs.readManifest()).toEqual({ aced: '1.10.0' })
		expect(prepareFs.readPluginRoots()).toEqual({ aced: '~/.codex/plugins/cache/mkt/aced/1.10.0' })
	})

	it('reports nothing when the harness has installed nothing yet', () => {
		for (const harness of ['claude-code', 'copilot-cli', 'codex', 'cursor'] as const) {
			expect(realPrepareFs(harness, { scope: 'global' }, environment()).readManifest()).toEqual({})
		}
	})
})
