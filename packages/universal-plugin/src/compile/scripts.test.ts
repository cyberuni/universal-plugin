import { describe, expect, it } from 'vitest'

import {
	binName,
	commandMap,
	compareScript,
	composeScript,
	embeddedData,
	parseScriptEntries,
	SCRIPT_GLOBAL,
	type ScriptData,
	sizeWarning,
	stampScript,
} from './scripts.js'

const entry = { output: 'skills/a/scripts/a.mjs', source: 'src/a.ts' }
const data = (overrides: Partial<ScriptData> = {}): ScriptData => ({
	package: 'demo',
	bin: 'demo',
	version: '1.0.0',
	entry: entry.output,
	commands: {},
	...overrides,
})

describe('parseScriptEntries — forward entries (ADR-0022)', () => {
	it('reads the own form and the pinned form', () => {
		expect(
			parseScriptEntries({
				'skills/a/scripts/demo.mjs': { forward: 'demo' },
				'./skills/a/scripts/other-cli.mjs': { forward: 'other-cli', package: 'other-pkg', version: '3.4.5' },
			}),
		).toEqual({
			entries: [],
			forwards: [
				{ output: 'skills/a/scripts/demo.mjs', bin: 'demo' },
				{ output: 'skills/a/scripts/other-cli.mjs', bin: 'other-cli', package: 'other-pkg', version: '3.4.5' },
			],
			rejected: [],
			errors: [],
		})
	})

	it('rejects a forwarder not named after its CLI, with compile options, or with an inexact version', () => {
		const { forwards, rejected, errors } = parseScriptEntries({
			'skills/a/scripts/run.mjs': { forward: 'demo' },
			'skills/a/scripts/demo.mjs': { forward: 'demo', source: 'src/a.ts' },
			'skills/b/scripts/x.mjs': { forward: 'x', package: 'x', version: '^1.0.0' },
			'skills/c/scripts/y.mjs': { forward: '' },
		})
		expect(forwards).toEqual([])
		// Each refused entry is listed, so the build reports it as a failed row (#304).
		expect(rejected).toEqual([
			{ output: 'skills/a/scripts/run.mjs', source: 'forward demo' },
			{ output: 'skills/a/scripts/demo.mjs', source: 'forward demo' },
			{ output: 'skills/b/scripts/x.mjs', source: 'forward x' },
			{ output: 'skills/c/scripts/y.mjs', source: 'forward ' },
		])
		expect(errors).toEqual([
			'scripts "skills/a/scripts/run.mjs" forwards to demo, so it must be named demo.mjs',
			'scripts "skills/a/scripts/demo.mjs" forwards to demo and takes no source: a forwarder is written, not compiled',
			'scripts "skills/b/scripts/x.mjs" has a version that is not an exact version',
			'scripts "skills/c/scripts/y.mjs" has a forward that is not a bin name',
		])
	})
})

describe('parseScriptEntries', () => {
	it('reads nothing from an absent declaration', () => {
		expect(parseScriptEntries(undefined)).toEqual({ entries: [], forwards: [], rejected: [], errors: [] })
	})

	it('reads the string and the object form', () => {
		expect(
			parseScriptEntries({
				'./skills/a/scripts/a.mjs': 'src/a.ts',
				'skills/b/scripts/b.mjs': { source: 'src/b.ts', command: ' task   get ' },
			}),
		).toEqual({
			entries: [
				{ output: 'skills/a/scripts/a.mjs', source: 'src/a.ts' },
				{ output: 'skills/b/scripts/b.mjs', source: 'src/b.ts', command: 'task get' },
			],
			forwards: [],
			rejected: [],
			errors: [],
		})
	})

	it('rejects a declaration that is not a map', () => {
		expect(parseScriptEntries(['src/a.ts']).errors).toEqual([
			'scripts is not a map from output path to source — no script was compiled',
		])
	})

	it('rejects an output that is not .mjs, or leaves the plugin', () => {
		const { entries, rejected, errors } = parseScriptEntries({
			'skills/a/scripts/a.js': 'src/a.ts',
			'../outside.mjs': 'src/b.ts',
			'/abs.mjs': 'src/c.ts',
		})
		expect(entries).toEqual([])
		expect(rejected).toEqual([
			{ output: 'skills/a/scripts/a.js', source: 'src/a.ts' },
			{ output: '../outside.mjs', source: 'src/b.ts' },
			{ output: '/abs.mjs', source: 'src/c.ts' },
		])
		expect(errors).toEqual([
			'scripts "skills/a/scripts/a.js" must name a .mjs file',
			'scripts "../outside.mjs" is not a path inside the plugin',
			'scripts "/abs.mjs" is not a path inside the plugin',
		])
	})

	it('rejects an entry with no source', () => {
		expect(parseScriptEntries({ 'a.mjs': { command: 'x' } }).errors).toEqual(['scripts "a.mjs" has no source'])
		expect(parseScriptEntries({ 'a.mjs': 3 }).errors).toEqual([
			'scripts "a.mjs" must map to a source path or { source, command }',
		])
	})

	it('reads the bundle options an entry sets', () => {
		expect(
			parseScriptEntries({
				'a.mjs': { source: 'a.ts', alias: { 'jsonc-parser': 'jsonc-parser/lib/esm/main.js' }, keepNames: true },
			}),
		).toEqual({
			entries: [
				{ output: 'a.mjs', source: 'a.ts', alias: { 'jsonc-parser': 'jsonc-parser/lib/esm/main.js' }, keepNames: true },
			],
			forwards: [],
			rejected: [],
			errors: [],
		})
	})

	it('rejects an alias that is not a string map, or a keepNames that is not a boolean', () => {
		expect(
			parseScriptEntries({
				'a.mjs': { source: 'a.ts', alias: ['x'] },
				'b.mjs': { source: 'b.ts', alias: { x: 1 } },
				'c.mjs': { source: 'c.ts', keepNames: 'yes' },
			}).errors,
		).toEqual([
			'scripts "a.mjs" has an alias that is not a map from import specifier to replacement',
			'scripts "b.mjs" has an alias that is not a map from import specifier to replacement',
			'scripts "c.mjs" has a keepNames that is not true or false',
		])
	})

	it('rejects two entries claiming one command', () => {
		expect(
			parseScriptEntries({ 'a.mjs': { source: 'a.ts', command: 'go' }, 'b.mjs': { source: 'b.ts', command: 'go' } })
				.errors,
		).toEqual(['scripts "a.mjs" and "b.mjs" both declare the command "go"'])
	})
})

describe('commandMap', () => {
	it('maps each declared command to its entry, sorted, skipping entries with none', () => {
		expect(
			commandMap([
				{ output: 'b.mjs', source: 'b.ts', command: 'task list' },
				{ output: 'x.mjs', source: 'x.ts' },
				{ output: 'a.mjs', source: 'a.ts', command: 'task get' },
			]),
		).toEqual({ 'task get': 'a.mjs', 'task list': 'b.mjs' })
		expect(
			Object.keys(
				commandMap([
					{ output: 'b.mjs', source: 'b.ts', command: 'b' },
					{ output: 'a.mjs', source: 'a.ts', command: 'a' },
				]),
			),
		).toEqual(['a', 'b'])
	})
})

describe('binName', () => {
	it('takes the package name, without its scope, for a string bin', () => {
		expect(binName({ name: '@acme/tool', bin: 'bin.mjs' })).toBe('tool')
	})

	it('takes the one bin, else the one named after the package, else the first', () => {
		expect(binName({ name: 'x', bin: { only: 'a.mjs' } })).toBe('only')
		expect(binName({ name: 'tool', bin: { upx: 'a.mjs', tool: 'b.mjs' } })).toBe('tool')
		expect(binName({ name: 'tool', bin: { a: 'a.mjs', b: 'b.mjs' } })).toBe('a')
	})

	it('is null with no package or no bin', () => {
		expect(binName(null)).toBeNull()
		expect(binName({ name: 'tool' })).toBeNull()
	})
})

describe('composeScript and embeddedData', () => {
	it('puts the header after a hashbang and before the code', () => {
		const script = composeScript('#!/usr/bin/env node\nconsole.log(1)', entry, data())
		const lines = script.split('\n')
		expect(lines[0]).toBe('#!/usr/bin/env node')
		expect(lines[1]).toContain('from src/a.ts')
		expect(lines[2]).toBe(`globalThis.${SCRIPT_GLOBAL} = ${JSON.stringify(data())};`)
		expect(lines[3]).toBe('console.log(1)')
		expect(script.endsWith('\n')).toBe(true)
	})

	it('reads back the embedded data', () => {
		expect(embeddedData(composeScript('x()\n', entry, data({ version: '2.0.0' })))).toEqual(data({ version: '2.0.0' }))
	})

	it('is null for a file with no header', () => {
		expect(embeddedData('console.log(1)\n')).toBeNull()
	})
})

describe('compareScript', () => {
	const compiled = composeScript('run()\n', entry, data({ version: '1.1.0' }))

	it('is missing with no file, unchanged when identical', () => {
		expect(compareScript(null, compiled)).toBe('missing')
		expect(compareScript(compiled, compiled)).toBe('unchanged')
	})

	it('is version when only the embedded version differs', () => {
		expect(compareScript(composeScript('run()\n', entry, data({ version: '1.0.0' })), compiled)).toBe('version')
	})

	it('is stale when the code differs, even with another version too', () => {
		expect(compareScript(composeScript('old()\n', entry, data({ version: '1.1.0' })), compiled)).toBe('stale')
		expect(compareScript(composeScript('old()\n', entry, data({ version: '1.0.0' })), compiled)).toBe('stale')
	})

	it('is stale when the command map differs', () => {
		const existing = composeScript('run()\n', entry, data({ version: '1.0.0', commands: { go: 'x.mjs' } }))
		expect(compareScript(existing, compiled)).toBe('stale')
	})

	it('is stale for a hand-written file with no header', () => {
		expect(compareScript('run()\n', compiled)).toBe('stale')
	})
})

describe('sizeWarning', () => {
	it('is null within the budget', () => {
		expect(sizeWarning('a.mjs', 150 * 1024, 'tool')).toBeNull()
	})

	it('names the size, the budget and the installed CLI over it', () => {
		expect(sizeWarning('a.mjs', 300 * 1024, 'tool')).toBe(
			'a.mjs is 300 KB, over the 150 KB budget for a compiled skill script — have the skill run the CLI through a forwarder instead: declare { "forward": "tool" } in the scripts extension (ADR-0022)',
		)
	})
})

describe('stampScript — forwarders', () => {
	it('leaves a pinned forwarder at the version its entry pins', () => {
		const pinned = composeScript('run()\n', entry, data({ version: '3.4.5', forward: 'pinned' }))
		expect(stampScript(pinned, '2.0.0')).toBeNull()
	})

	it('stamps an own forwarder like any compiled script', () => {
		const own = composeScript('run()\n', entry, data({ forward: 'own' }))
		expect(embeddedData(stampScript(own, '2.0.0') ?? '')?.version).toBe('2.0.0')
	})
})

describe('stampScript', () => {
	it('writes the version into the header and changes nothing else', () => {
		const before = composeScript('run()\n', entry, data({ version: '1.0.0' }))
		expect(stampScript(before, '1.1.0')).toBe(composeScript('run()\n', entry, data({ version: '1.1.0' })))
	})

	it('is null for a file with no header, or one already on the version', () => {
		expect(stampScript('run()\n', '1.1.0')).toBeNull()
		expect(stampScript(composeScript('run()\n', entry, data({ version: '1.1.0' })), '1.1.0')).toBeNull()
	})
})
