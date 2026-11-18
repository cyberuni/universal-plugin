import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { gatherCatalogRepo, gitToplevel } from './fs.js'

let dir: string

beforeEach(() => {
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-toplevel-')))
	fs.mkdirSync(path.join(dir, 'real/repo/packages/a'), { recursive: true })
	execFileSync('git', ['init', '-q', path.join(dir, 'real/repo')])
	fs.mkdirSync(path.join(dir, 'real/repo/.claude-plugin'))
	fs.writeFileSync(path.join(dir, 'real/repo/.claude-plugin/marketplace.json'), '{}\n')
})
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
})

/** A second spelling of `real/`, as an 8.3 short name gives one on Windows. */
function alias(): string | undefined {
	try {
		fs.symlinkSync(path.join(dir, 'real'), path.join(dir, 'alias'), 'junction')
	} catch {
		return undefined // symlinks need privileges on some Windows runners
	}
	return path.join(dir, 'alias')
}

describe('gitToplevel', () => {
	it('spells the top level the way the plugin root is spelled, not the way git prints it', () => {
		const spelled = alias()
		if (!spelled) return

		expect(gitToplevel(path.join(spelled, 'repo/packages/a'))).toBe(path.join(spelled, 'repo'))
	})

	it("keeps git's spelling when the plugin root is itself a link from outside the repository", () => {
		fs.symlinkSync(path.join(dir, 'real/repo/packages/a'), path.join(dir, 'link'), 'junction')

		expect(gitToplevel(path.join(dir, 'link'))).toBe(fs.realpathSync.native(path.join(dir, 'real/repo')))
	})

	it('is undefined outside any repository', () => {
		expect(gitToplevel(dir)).toBeUndefined()
	})
})

describe('gatherCatalogRepo', () => {
	it('finds the catalogs of a plugin root spelled differently from git', () => {
		const spelled = alias()
		if (!spelled) return

		expect(gatherCatalogRepo(path.join(spelled, 'repo/packages/a'))).toEqual({
			root: path.join(spelled, 'repo'),
			pluginPath: 'packages/a',
			catalogs: { '.claude-plugin/marketplace.json': '{}\n' },
		})
	})
})
