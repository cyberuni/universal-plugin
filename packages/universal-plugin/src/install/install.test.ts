import { describe, expect, it } from 'vitest'

import type { DestState, VendorTarget } from './install.js'
import { planInstall, planUninstall } from './install.js'

const ROOT = '/repo/my-plugin'

const claudeCode: VendorTarget = {
	vendor: 'claude-code',
	dir: '/home/dev/.claude/skills',
	link: true,
	manifestPath: '.claude-plugin/plugin.json',
}
const cursor: VendorTarget = {
	vendor: 'cursor',
	dir: '/home/dev/.cursor/plugins/local',
	link: false,
	manifestPath: '.cursor-plugin/plugin.json',
}
const codex: VendorTarget = { vendor: 'codex', dir: null, link: false, manifestPath: '.codex-plugin/plugin.json' }

const absent: DestState = { kind: 'absent' }
const ourLink: DestState = { kind: 'symlink', target: ROOT }
const ourCopy: DestState = { kind: 'directory', pluginName: 'my-plugin' }

function input(overrides: Partial<Parameters<typeof planInstall>[0]> = {}) {
	return {
		pluginName: 'my-plugin',
		root: ROOT,
		mode: 'auto' as const,
		force: false,
		targets: [claudeCode],
		dest: { 'claude-code': absent } as Record<string, DestState>,
		manifests: { 'claude-code': true } as Record<string, boolean>,
		...overrides,
	}
}

describe('planInstall — destination resolution', () => {
	it('installs into the vendor local plugin directory under the plugin name', () => {
		const plan = planInstall(input())
		expect(plan.rows).toEqual([{ vendor: 'claude-code', path: '/home/dev/.claude/skills/my-plugin', action: 'linked' }])
		expect(plan.writes).toEqual([
			{ vendor: 'claude-code', dest: '/home/dev/.claude/skills/my-plugin', mode: 'link', replace: false },
		])
	})

	it('plans one row per target vendor', () => {
		const plan = planInstall(
			input({
				targets: [claudeCode, cursor],
				dest: { 'claude-code': absent, cursor: absent },
				manifests: { 'claude-code': true, cursor: true },
			}),
		)
		expect(plan.rows.map((r) => r.vendor)).toEqual(['claude-code', 'cursor'])
	})

	it('reports a vendor with no local plugin directory as unsupported and writes nothing for it', () => {
		const plan = planInstall(input({ targets: [codex], dest: { codex: absent }, manifests: { codex: true } }))
		expect(plan.rows[0]).toMatchObject({ vendor: 'codex', action: 'unsupported' })
		expect(plan.writes).toEqual([])
	})
})

describe('planInstall — link and copy', () => {
	it('auto links where the vendor loads an out-of-tree symlink', () => {
		expect(planInstall(input()).writes[0]?.mode).toBe('link')
	})

	it('auto copies where the vendor rejects an out-of-tree symlink', () => {
		const plan = planInstall(input({ targets: [cursor], dest: { cursor: absent }, manifests: { cursor: true } }))
		expect(plan.writes[0]?.mode).toBe('copy')
		expect(plan.rows[0]?.action).toBe('copied')
	})

	it('--copy copies even where the vendor would load a symlink', () => {
		const plan = planInstall(input({ mode: 'copy' }))
		expect(plan.writes[0]?.mode).toBe('copy')
	})

	it('--link blocks a vendor that rejects an out-of-tree symlink, naming --copy', () => {
		const plan = planInstall(
			input({ mode: 'link', targets: [cursor], dest: { cursor: absent }, manifests: { cursor: true } }),
		)
		expect(plan.rows[0]?.action).toBe('blocked')
		expect(plan.rows[0]?.reason).toMatch(/--copy/)
		expect(plan.writes).toEqual([])
	})
})

describe('planInstall — an occupied destination', () => {
	it('re-running over our own symlink changes nothing', () => {
		const plan = planInstall(input({ dest: { 'claude-code': ourLink } }))
		expect(plan.rows[0]?.action).toBe('unchanged')
		expect(plan.writes).toEqual([])
	})

	it('replaces our own earlier copy rather than stacking', () => {
		const plan = planInstall(input({ mode: 'copy', dest: { 'claude-code': ourCopy } }))
		expect(plan.rows[0]?.action).toBe('copied')
		expect(plan.writes[0]?.replace).toBe(true)
	})

	it('replaces our own symlink when the mode changes to copy', () => {
		const plan = planInstall(input({ mode: 'copy', dest: { 'claude-code': ourLink } }))
		expect(plan.writes[0]).toMatchObject({ mode: 'copy', replace: true })
	})

	it('blocks a symlink pointing at another plugin, naming --force', () => {
		const plan = planInstall(input({ dest: { 'claude-code': { kind: 'symlink', target: '/repo/other' } } }))
		expect(plan.rows[0]?.action).toBe('blocked')
		expect(plan.rows[0]?.reason).toMatch(/--force/)
		expect(plan.writes).toEqual([])
	})

	it('blocks a directory holding a different plugin', () => {
		const plan = planInstall(input({ dest: { 'claude-code': { kind: 'directory', pluginName: 'other' } } }))
		expect(plan.rows[0]?.action).toBe('blocked')
	})

	it('blocks a directory that carries no manifest at all', () => {
		const plan = planInstall(input({ dest: { 'claude-code': { kind: 'directory', pluginName: null } } }))
		expect(plan.rows[0]?.action).toBe('blocked')
	})

	it('blocks a plain file', () => {
		expect(planInstall(input({ dest: { 'claude-code': { kind: 'file' } } })).rows[0]?.action).toBe('blocked')
	})

	it('--force replaces whatever occupies the destination', () => {
		const plan = planInstall(
			input({ force: true, dest: { 'claude-code': { kind: 'directory', pluginName: 'other' } } }),
		)
		expect(plan.rows[0]?.action).toBe('linked')
		expect(plan.writes[0]?.replace).toBe(true)
	})
})

describe('planInstall — the derived manifest guard', () => {
	it('fails when a target vendor has no derived manifest, naming plugin build', () => {
		expect(() => planInstall(input({ manifests: { 'claude-code': false } }))).toThrow(/plugin build/)
	})

	it('names the missing manifest path', () => {
		expect(() => planInstall(input({ manifests: { 'claude-code': false } }))).toThrow(/\.claude-plugin\/plugin\.json/)
	})

	it('ignores a missing manifest for a vendor with no local plugin directory', () => {
		expect(() =>
			planInstall(input({ targets: [codex], dest: { codex: absent }, manifests: { codex: false } })),
		).not.toThrow()
	})
})

describe('planInstall — the summary', () => {
	it('counts each outcome', () => {
		const plan = planInstall(
			input({
				targets: [claudeCode, cursor, codex],
				dest: { 'claude-code': ourLink, cursor: absent, codex: absent },
				manifests: { 'claude-code': true, cursor: true, codex: true },
			}),
		)
		expect(plan.summary).toEqual({ installed: 1, unchanged: 1, blocked: 0, unsupported: 1 })
	})
})

describe('planUninstall', () => {
	it('removes our own symlink', () => {
		const plan = planUninstall(input({ dest: { 'claude-code': ourLink } }))
		expect(plan.rows[0]).toMatchObject({ vendor: 'claude-code', action: 'removed' })
		expect(plan.removals).toEqual(['/home/dev/.claude/skills/my-plugin'])
	})

	it('removes our own copy', () => {
		const plan = planUninstall(input({ dest: { 'claude-code': ourCopy } }))
		expect(plan.rows[0]?.action).toBe('removed')
	})

	it('reports an absent destination as missing rather than failing', () => {
		const plan = planUninstall(input())
		expect(plan.rows[0]?.action).toBe('missing')
		expect(plan.removals).toEqual([])
	})

	it('never removes another plugin without --force', () => {
		const plan = planUninstall(input({ dest: { 'claude-code': { kind: 'directory', pluginName: 'other' } } }))
		expect(plan.rows[0]?.action).toBe('blocked')
		expect(plan.removals).toEqual([])
	})

	it('--force removes a destination we do not own', () => {
		const plan = planUninstall(
			input({ force: true, dest: { 'claude-code': { kind: 'symlink', target: '/repo/other' } } }),
		)
		expect(plan.rows[0]?.action).toBe('removed')
	})

	it('reports a vendor with no local plugin directory as unsupported', () => {
		const plan = planUninstall(input({ targets: [codex], dest: { codex: absent }, manifests: { codex: true } }))
		expect(plan.rows[0]?.action).toBe('unsupported')
	})

	it('does not require a derived manifest', () => {
		expect(() => planUninstall(input({ manifests: { 'claude-code': false } }))).not.toThrow()
	})
})
