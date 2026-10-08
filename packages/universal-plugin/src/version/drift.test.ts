import { describe, expect, it } from 'vitest'

import { checkVersionDrift, type DriftState } from './drift.js'

function state(overrides: Partial<DriftState> = {}): DriftState {
	return {
		manifest: { name: 'my-plugin', version: '1.2.3' },
		packagePath: null,
		packageJson: null,
		vendorManifests: [],
		catalogs: [],
		skillFiles: [],
		...overrides,
	}
}

const npm: Partial<DriftState> = { packagePath: '.', packageJson: { name: 'my-plugin-cli', version: '1.2.3' } }

const catalog = (version: string, name = 'my-plugin') =>
	JSON.stringify({
		name: 'mkt',
		plugins: [
			{ name: 'other', version: '9.9.9' },
			{ name, version },
		],
	})

const drifted = (s: DriftState) => checkVersionDrift(s).drifted.map((d) => d.path)

describe('checkVersionDrift — the reference', () => {
	it('every file agreeing reports nothing', () => {
		const result = checkVersionDrift(
			state({
				...npm,
				vendorManifests: [{ path: '.claude-plugin/plugin.json', content: '{"version":"1.2.3"}' }],
				catalogs: [{ path: '.claude-plugin/marketplace.json', content: catalog('1.2.3') }],
				skillFiles: [{ path: 'skills/a/SKILL.md', content: 'run `npx -y my-plugin-cli@1.2.3 build`' }],
			}),
		)
		expect(result.drifted).toEqual([])
		expect(result.surfaces).toHaveLength(5)
	})

	it('the package.json is the reference when packagePath is declared', () => {
		const result = checkVersionDrift(state({ ...npm, packageJson: { name: 'x', version: '1.3.0' } }))
		expect(result.expected).toBe('1.3.0')
		expect(result.source).toBe('package.json')
		expect(result.drifted).toEqual([{ path: 'plugin.json', kind: 'manifest', version: '1.2.3' }])
	})

	it('plugin.json is the reference when no packagePath is declared', () => {
		const result = checkVersionDrift(
			state({ vendorManifests: [{ path: '.codex-plugin/plugin.json', content: '{"version":"1.0.0"}' }] }),
		)
		expect(result.expected).toBe('1.2.3')
		expect(result.source).toBe('plugin.json')
		expect(result.drifted.map((d) => d.path)).toEqual(['.codex-plugin/plugin.json'])
	})

	it('a manifest with no version under a versioned package drifts', () => {
		const result = checkVersionDrift(state({ ...npm, manifest: { name: 'my-plugin' } }))
		expect(result.drifted).toEqual([{ path: 'plugin.json', kind: 'manifest', version: null }])
	})

	it('nothing is compared when no authored file carries a version', () => {
		const result = checkVersionDrift(
			state({
				manifest: { name: 'my-plugin' },
				vendorManifests: [{ path: '.claude-plugin/plugin.json', content: '{"version":"1.0.0"}' }],
			}),
		)
		expect(result.expected).toBeNull()
		expect(result.drifted).toEqual([])
	})

	it('a declared packagePath with no package.json fails', () => {
		expect(() => checkVersionDrift(state({ packagePath: 'pkg' }))).toThrow(/No package.json found at packagePath "pkg"/)
	})

	it('the package path is reported as declared', () => {
		const result = checkVersionDrift(state({ packagePath: '../../packages/cli/', packageJson: { version: '2.0.0' } }))
		expect(result.source).toBe('../../packages/cli/package.json')
	})
})

describe('checkVersionDrift — derived files', () => {
	it('names each derived manifest left behind', () => {
		const result = drifted(
			state({
				...npm,
				packageJson: { name: 'x', version: '0.9.0' },
				manifest: { name: 'my-plugin', version: '0.9.0' },
				vendorManifests: [
					{ path: '.claude-plugin/plugin.json', content: '{"version":"0.8.0"}' },
					{ path: '.cursor-plugin/plugin.json', content: '{"version":"0.9.0"}' },
					{ path: '.codex-plugin/plugin.json', content: '{"version":"0.8.0"}' },
				],
			}),
		)
		expect(result).toEqual(['.claude-plugin/plugin.json', '.codex-plugin/plugin.json'])
	})

	it('a derived manifest that carries no version is not compared', () => {
		expect(drifted(state({ vendorManifests: [{ path: '.cursor-plugin/plugin.json', content: '{}' }] }))).toEqual([])
	})

	it("reads only this plugin's catalog entry", () => {
		expect(
			drifted(
				state({
					catalogs: [
						{ path: '.claude-plugin/marketplace.json', content: catalog('1.0.0') },
						{ path: '.agents/plugins/marketplace.json', content: catalog('1.0.0', 'someone-else') },
					],
				}),
			),
		).toEqual(['.claude-plugin/marketplace.json'])
	})

	it('an unparsable catalog is not compared', () => {
		expect(drifted(state({ catalogs: [{ path: 'x.json', content: '{' }] }))).toEqual([])
	})
})

describe('checkVersionDrift — skill pins', () => {
	it('names each skill file pinning the package at another version, in either runner and flag spelling', () => {
		const result = drifted(
			state({
				...npm,
				skillFiles: [
					{ path: 'skills/a/SKILL.md', content: 'npx --yes my-plugin-cli@1.2.2 build' },
					{ path: 'skills/b/SKILL.md', content: 'upx my-plugin-cli@1.2.3' },
					{ path: 'skills/c/SKILL.md', content: '`npx -y my-plugin-cli@1.0.0`' },
				],
			}),
		)
		expect(result).toEqual(['skills/a/SKILL.md', 'skills/c/SKILL.md'])
	})

	it('a pin of another package is not compared', () => {
		expect(
			drifted(state({ ...npm, skillFiles: [{ path: 'skills/a/SKILL.md', content: 'npx -y other-cli@0.1.0' }] })),
		).toEqual([])
	})

	it('a placeholder or a dist-tag is not a version left behind', () => {
		expect(
			drifted(
				state({
					...npm,
					skillFiles: [
						{ path: 'skills/a/SKILL.md', content: 'npx my-plugin-cli@<version> and npx my-plugin-cli@latest' },
					],
				}),
			),
		).toEqual([])
	})

	it('a pin-exempt skill is skipped, with every file under it', () => {
		expect(
			drifted(
				state({
					...npm,
					skillFiles: [
						{ path: 'skills/a/SKILL.md', content: '---\nmetadata:\n  pin-exempt: true\n---\nnpx my-plugin-cli@0.1.0' },
						{ path: 'skills/a/references/x.md', content: 'npx my-plugin-cli@0.1.0' },
					],
				}),
			),
		).toEqual([])
	})

	it('pins are not compared without a package to pin', () => {
		expect(drifted(state({ skillFiles: [{ path: 'skills/a/SKILL.md', content: 'npx my-plugin@0.1.0' }] }))).toEqual([])
	})
})
