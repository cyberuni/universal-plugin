import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { compileScripts } from './compile.js'
import { embeddedData, type ScriptCompiler } from './scripts.js'

let dir: string

beforeEach(() => {
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-compile-')))
})
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, content: string) {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
	fs.writeFileSync(path.join(dir, rel), content)
}

function manifest(scripts: unknown, version = '1.2.3') {
	write(
		'plugin.json',
		JSON.stringify({ name: 'demo', version, extensions: { 'org.cyberuni.universal-plugin': { scripts } } }),
	)
}

/** Compiles by echoing the source, so a test controls the output through the source file. */
const echo: ScriptCompiler = { compile: async (source) => fs.readFileSync(source, 'utf8') }
const read = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8')

describe('compileScripts', () => {
	it('does nothing when no script is declared', async () => {
		manifest(undefined)
		expect(await compileScripts(dir, {}, echo)).toEqual({
			rows: [],
			written: [],
			warnings: [],
			summary: { compiled: 0, unchanged: 0, behind: 0, failed: 0 },
		})
	})

	it('writes each entry with its header, then leaves it unchanged', async () => {
		manifest({ 'skills/a/scripts/a.mjs': { source: 'src/a.ts', command: 'a' } })
		write('src/a.ts', 'run()\n')

		const first = await compileScripts(dir, {}, echo)
		expect(first.rows).toEqual([
			{ path: 'skills/a/scripts/a.mjs', source: 'src/a.ts', status: 'compiled', bytes: expect.any(Number) },
		])
		expect(first.written).toEqual([path.join(dir, 'skills/a/scripts/a.mjs')])
		expect(read('skills/a/scripts/a.mjs')).toMatch(/\nrun\(\)\n$/)

		const second = await compileScripts(dir, {}, echo)
		expect(second.rows[0]?.status).toBe('unchanged')
		expect(second.written).toEqual([])
	})

	it('embeds the plugin.json version, and the package and bin from packagePath — never the package version', async () => {
		manifest({ 'skills/a/scripts/a.mjs': { source: 'src/a.ts', command: 'a get' }, 'b.mjs': 'src/a.ts' }, '1.2.3')
		write('src/a.ts', 'run()\n')
		write('.agents/universal-plugin.json', JSON.stringify({ packagePath: 'pkg' }))
		write('pkg/package.json', JSON.stringify({ name: '@acme/demo', version: '0.0.0-development', bin: { demo: 'x' } }))

		await compileScripts(dir, {}, echo)

		expect(embeddedData(read('b.mjs'))).toEqual({
			package: '@acme/demo',
			bin: 'demo',
			version: '1.2.3',
			entry: 'b.mjs',
			commands: { 'a get': 'skills/a/scripts/a.mjs' },
		})
	})

	it('passes each entry its own bundle options, and none to an entry that sets none', async () => {
		manifest({
			'a.mjs': { source: 'src/a.ts', alias: { x: 'y' }, keepNames: true },
			'b.mjs': 'src/a.ts',
		})
		write('src/a.ts', 'run()\n')
		const seen: unknown[] = []
		const recording: ScriptCompiler = {
			compile: async (source, root, options) => {
				seen.push(options)
				return echo.compile(source, root)
			},
		}

		await compileScripts(dir, {}, recording)

		expect(seen).toEqual([{ alias: { x: 'y' }, keepNames: true }, {}])
	})

	it('a dry run writes nothing and reports how each committed file compares', async () => {
		manifest({ 'a.mjs': 'src/a.ts', 'b.mjs': 'src/b.ts', 'c.mjs': 'src/c.ts', 'd.mjs': 'src/d.ts' }, '1.0.0')
		for (const s of ['a', 'b', 'c', 'd']) write(`src/${s}.ts`, `${s}()\n`)
		await compileScripts(dir, {}, echo)
		fs.rmSync(path.join(dir, 'a.mjs'))
		write('src/b.ts', 'changed()\n')
		manifest({ 'a.mjs': 'src/a.ts', 'b.mjs': 'src/b.ts', 'c.mjs': 'src/c.ts', 'd.mjs': 'src/d.ts' }, '1.1.0')
		const before = read('c.mjs')

		const result = await compileScripts(dir, { dryRun: true }, echo)

		expect(result.rows.map((r) => [r.path, r.status])).toEqual([
			['a.mjs', 'missing'],
			['b.mjs', 'stale'],
			['c.mjs', 'version'],
			['d.mjs', 'version'],
		])
		expect(result.written).toEqual([])
		expect(read('c.mjs')).toBe(before)
		expect(fs.existsSync(path.join(dir, 'a.mjs'))).toBe(false)
		expect(result.summary).toEqual({ compiled: 0, unchanged: 0, behind: 4, failed: 0 })
	})

	it('fails an entry whose source is missing or does not compile, and compiles the rest', async () => {
		manifest({ 'a.mjs': 'src/missing.ts', 'b.mjs': 'src/bad.ts', 'c.mjs': 'src/c.ts' })
		write('src/bad.ts', 'x')
		write('src/c.ts', 'c()\n')
		const failing: ScriptCompiler = {
			compile: async (source) => {
				if (source.endsWith('bad.ts')) throw new Error('imports nope')
				return echo.compile(source, dir)
			},
		}

		const result = await compileScripts(dir, {}, failing)

		expect(result.rows.map((r) => r.status)).toEqual(['failed', 'failed', 'compiled'])
		expect(result.warnings).toEqual([
			'script source "src/missing.ts" for a.mjs not found — not compiled',
			'Failed to compile src/bad.ts → b.mjs: imports nope',
		])
		expect(result.summary.failed).toBe(2)
	})

	it('warns, naming file, line and code point, about an invisible character left in the output', async () => {
		manifest({ 'a.mjs': 'src/a.ts' })
		write('src/a.ts', '// note\u200B\nconst x = 1\u00AD\n')

		const result = await compileScripts(dir, {}, echo)

		expect(result.warnings).toEqual([
			'a.mjs:3:8 U+200B and 1 more: invisible character in the compiled script that the build could not escape — skill checks reject it; write it as an escape in a string literal in the source',
		])
	})

	it('fails a malformed entry with a warning and compiles the valid entries', async () => {
		manifest({ 'a.js': 'src/a.ts', 'b.mjs': 'src/b.ts' })
		write('src/b.ts', 'b()\n')
		const result = await compileScripts(dir, {}, echo)
		expect(result.warnings).toEqual(['scripts "a.js" must name a .mjs file'])
		expect(result.rows.map((r) => [r.path, r.status])).toEqual([
			['a.js', 'failed'],
			['b.mjs', 'compiled'],
		])
		expect(result.summary.failed).toBe(1)
	})

	it('warns on a script over the size budget', async () => {
		manifest({ 'a.mjs': 'src/a.ts' })
		write('src/a.ts', `// ${'x'.repeat(160 * 1024)}\n`)
		const result = await compileScripts(dir, {}, echo)
		expect(result.warnings).toEqual([expect.stringMatching(/^a\.mjs is 160 KB, over the 150 KB budget/)])
		expect(result.rows[0]?.status).toBe('compiled')
	})

	describe('forward entries (ADR-0022)', () => {
		const ownPackage = () => {
			write('.agents/universal-plugin.json', JSON.stringify({ packagePath: '.' }))
			write(
				'package.json',
				JSON.stringify({ name: 'demo-pkg', version: '0.0.0-development', bin: { demo: 'bin/demo.mjs' } }),
			)
		}

		it('writes a forwarder for the own CLI with the plugin.json version, then leaves it unchanged', async () => {
			manifest({ 'skills/a/scripts/demo.mjs': { forward: 'demo' } }, '1.2.0')
			ownPackage()

			const first = await compileScripts(dir, {}, echo)
			expect(first.rows).toEqual([
				{ path: 'skills/a/scripts/demo.mjs', source: 'forward demo', status: 'compiled', bytes: expect.any(Number) },
			])
			const content = read('skills/a/scripts/demo.mjs')
			expect(content.startsWith('#!')).toBe(false)
			expect(embeddedData(content)).toMatchObject({
				package: 'demo-pkg',
				bin: 'demo',
				version: '1.2.0',
				forward: 'own',
			})

			expect((await compileScripts(dir, {}, echo)).rows[0]?.status).toBe('unchanged')
		})

		it('writes a forwarder for another package at its pinned version', async () => {
			manifest({ 'skills/a/scripts/other-cli.mjs': { forward: 'other-cli', package: 'other-pkg', version: '3.4.5' } })
			ownPackage()

			await compileScripts(dir, {}, echo)

			expect(embeddedData(read('skills/a/scripts/other-cli.mjs'))).toMatchObject({
				package: 'other-pkg',
				bin: 'other-cli',
				version: '3.4.5',
				forward: 'pinned',
			})
		})

		it('reports a missing forwarder, then one behind only on its version, on a dry run', async () => {
			manifest({ 'skills/a/scripts/demo.mjs': { forward: 'demo' } }, '1.2.0')
			ownPackage()
			expect((await compileScripts(dir, { dryRun: true }, echo)).rows[0]?.status).toBe('missing')

			await compileScripts(dir, {}, echo)
			manifest({ 'skills/a/scripts/demo.mjs': { forward: 'demo' } }, '1.3.0')
			const result = await compileScripts(dir, { dryRun: true }, echo)
			expect(result.rows[0]?.status).toBe('version')
			expect(result.summary.behind).toBe(1)
		})

		it('reports a pinned forwarder whose entry moved its pin as stale', async () => {
			ownPackage()
			manifest({ 'skills/a/scripts/x.mjs': { forward: 'x', package: 'x-pkg', version: '1.0.0' } })
			await compileScripts(dir, {}, echo)
			manifest({ 'skills/a/scripts/x.mjs': { forward: 'x', package: 'x-pkg', version: '1.1.0' } })
			expect((await compileScripts(dir, { dryRun: true }, echo)).rows[0]?.status).toBe('stale')
		})

		it('fails a forwarder for a bin the own package does not declare, or another package without a version', async () => {
			ownPackage()
			manifest({
				'skills/a/scripts/nope.mjs': { forward: 'nope' },
				'skills/a/scripts/other-cli.mjs': { forward: 'other-cli', package: 'other-pkg' },
				'skills/a/scripts/demo.mjs': { forward: 'demo', package: 'demo-pkg', version: '1.0.0' },
			})

			const result = await compileScripts(dir, {}, echo)

			expect(result.warnings).toEqual([
				'scripts "skills/a/scripts/nope.mjs" forwards to nope, which is not a bin of demo-pkg — not written',
				'scripts "skills/a/scripts/other-cli.mjs" forwards to other-pkg, another package: pin its version with "version" — not written',
				'scripts "skills/a/scripts/demo.mjs" pins a version for the own package demo-pkg, whose version plugin.json carries — not written',
			])
			expect(result.summary.failed).toBe(3)
			expect(fs.existsSync(path.join(dir, 'skills/a/scripts/nope.mjs'))).toBe(false)
		})

		// Issue #304: a refused entry was warned about and dropped, so `--check` passed without it.
		it('fails a forwarder named differently from its bin, on a write and on a dry run', async () => {
			ownPackage()
			manifest({ 'skills/a/scripts/run.mjs': { forward: 'demo' }, 'skills/a/scripts/demo.mjs': { forward: 'demo' } })

			for (const dryRun of [false, true]) {
				const result = await compileScripts(dir, { dryRun }, echo)
				expect(result.rows[0]).toEqual({ path: 'skills/a/scripts/run.mjs', source: 'forward demo', status: 'failed' })
				expect(result.warnings).toContain(
					'scripts "skills/a/scripts/run.mjs" forwards to demo, so it must be named demo.mjs',
				)
				expect(result.summary.failed).toBe(1)
			}
			expect(fs.existsSync(path.join(dir, 'skills/a/scripts/run.mjs'))).toBe(false)
		})

		it('fails an own forwarder when the plugin ships to no package', async () => {
			manifest({ 'skills/a/scripts/demo.mjs': { forward: 'demo' } })
			const result = await compileScripts(dir, {}, echo)
			expect(result.warnings[0]).toMatch(/the plugin ships to no package/)
			expect(result.rows[0]?.status).toBe('failed')
		})
	})
})
