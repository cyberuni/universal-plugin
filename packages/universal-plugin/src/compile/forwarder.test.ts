import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { composeForwarder } from './forwarder.js'
import { embeddedData } from './scripts.js'

let dir: string
let fakeBin: string

beforeEach(() => {
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-forwarder-')))
	// A stand-in npx on PATH that reports what it was asked to run, so no test reaches the registry.
	fakeBin = path.join(dir, 'fake-bin')
	write('fake-bin/fake-npx.mjs', 'console.log(JSON.stringify({ npx: process.argv.slice(2) }))\nprocess.exit(7)\n')
	write('fake-bin/npx', '#!/bin/sh\nexec node "$(dirname "$0")/fake-npx.mjs" "$@"\n')
	fs.chmodSync(path.join(fakeBin, 'npx'), 0o755)
	write('fake-bin/npx.cmd', '@node "%~dp0fake-npx.mjs" %*\r\n')
})
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, content: string) {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
	fs.writeFileSync(path.join(dir, rel), content)
}

function forwarder(rel: string, data: { package: string; bin: string; version: string; forward?: 'own' | 'pinned' }) {
	write(rel, composeForwarder({ entry: rel, commands: {}, forward: 'own', ...data }))
}

/** A checkout of `demo-pkg` whose `demo` bin reports its arguments and exits 3. */
function checkout(rel: string) {
	write(`${rel}/package.json`, JSON.stringify({ name: 'demo-pkg', bin: { demo: 'bin/demo.mjs' } }))
	write(`${rel}/bin/demo.mjs`, 'console.log(JSON.stringify({ bin: process.argv.slice(2) }))\nprocess.exit(3)\n')
}

/** A checkout whose committed bin imports its build output under `output/`, as repobuddy's
 *  `bin/buddy.js` imports `../esm/bin.js`. The CLI reports its arguments and exits 4. */
function builtCheckout(rel: string, output: string) {
	write(`${rel}/package.json`, JSON.stringify({ name: 'demo-pkg', bin: { demo: 'bin/demo.mjs' } }))
	write(`${rel}/bin/demo.mjs`, `#!/usr/bin/env node\nimport '../${output}/cli.mjs'\n`)
	write(`${rel}/${output}/cli.mjs`, 'console.log(JSON.stringify({ cli: process.argv.slice(2) }))\nprocess.exit(4)\n')
}

/** The environment with the fake npx first on the search path. Windows spells the key `Path`, and a
 *  second `PATH` key beside it leaves which one the child sees to chance, so replace the one there. */
function fakeNpxEnv() {
	const env = { ...process.env }
	const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
	env[key] = `${fakeBin}${path.delimiter}${env[key] ?? ''}`
	return env
}

function run(rel: string, args: string[], input?: string) {
	const result = spawnSync(process.execPath, [path.join(dir, rel), ...args], {
		encoding: 'utf8',
		env: fakeNpxEnv(),
		input,
	})
	return { status: result.status, stdout: JSON.parse(result.stdout.trim() || 'null'), stderr: result.stderr }
}

const demo = { package: 'demo-pkg', bin: 'demo', version: '1.2.0' }

describe('composeForwarder', () => {
	it('embeds the package, bin, version and forward kind, with no hashbang', () => {
		const content = composeForwarder({ ...demo, entry: 'skills/a/scripts/demo.mjs', commands: {}, forward: 'own' })
		expect(content.startsWith('#!')).toBe(false)
		expect(embeddedData(content)).toEqual({
			...demo,
			entry: 'skills/a/scripts/demo.mjs',
			commands: {},
			forward: 'own',
		})
	})
})

describe('the forwarder at run time', () => {
	it('runs the dev checkout bin with node, passing every argument and the exit code', () => {
		checkout('pkg')
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		const result = run('pkg/skills/demo/scripts/demo.mjs', ['a', 'b c', '--flag'])

		expect(result.stdout).toEqual({ bin: ['a', 'b c', '--flag'] })
		expect(result.status).toBe(3)
	})

	it('finds the checkout through a symlinked skill folder, from its real path', () => {
		checkout('pkg')
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)
		fs.mkdirSync(path.join(dir, 'agent/skills'), { recursive: true })
		try {
			fs.symlinkSync(path.join(dir, 'pkg/skills/demo'), path.join(dir, 'agent/skills/demo'), 'junction')
		} catch {
			return // symlinks need privileges on some Windows runners
		}

		expect(run('agent/skills/demo/scripts/demo.mjs', ['x']).stdout).toEqual({ bin: ['x'] })
	})

	it('runs a built checkout whose bin imports its build output', () => {
		builtCheckout('pkg', 'esm')
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		const result = run('pkg/skills/demo/scripts/demo.mjs', ['a'])

		expect(result.stdout).toEqual({ cli: ['a'] })
		expect(result.status).toBe(4)
	})

	it('runs npx when the bin imports build output the checkout does not have, as a git install does', () => {
		builtCheckout('pkg', 'esm')
		fs.rmSync(path.join(dir, 'pkg/esm'), { recursive: true })
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		const result = run('pkg/skills/demo/scripts/demo.mjs', ['a'])

		expect(result.stdout).toEqual({ npx: ['-y', 'demo-pkg@1.2.0', 'a'] })
		expect(result.stderr).toBe('')
	})

	it('runs npx when the declared bin file itself is missing', () => {
		write('pkg/package.json', JSON.stringify({ name: 'demo-pkg', bin: { demo: 'dist/cli.mjs' } }))
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		expect(run('pkg/skills/demo/scripts/demo.mjs', ['a']).stdout).toEqual({ npx: ['-y', 'demo-pkg@1.2.0', 'a'] })
	})

	it('resolves a require without an extension', () => {
		write('pkg/package.json', JSON.stringify({ name: 'demo-pkg', bin: { demo: 'bin/demo.cjs' } }))
		write('pkg/bin/demo.cjs', "require('../lib/cli')\n")
		write('pkg/lib/cli.js', 'console.log(JSON.stringify({ cli: process.argv.slice(2) }))\n')
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		expect(run('pkg/skills/demo/scripts/demo.mjs', ['a']).stdout).toEqual({ cli: ['a'] })
	})

	for (const output of ['dist', 'esm']) {
		it(`warns when ${output}/, the folder the bin imports, is older than src, and still runs the bin`, () => {
			builtCheckout('pkg', output)
			write('pkg/src/cli.ts', '')
			const past = new Date(Date.now() - 60_000)
			fs.utimesSync(path.join(dir, `pkg/${output}/cli.mjs`), past, past)
			forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

			const result = run('pkg/skills/demo/scripts/demo.mjs', ['x'])

			expect(result.stderr).toMatch(new RegExp(`${output}/ in .* is older than src/`))
			expect(result.stdout).toEqual({ cli: ['x'] })
		})
	}

	it('does not warn when the build output is newer than src', () => {
		builtCheckout('pkg', 'esm')
		write('pkg/src/cli.ts', '')
		const past = new Date(Date.now() - 60_000)
		fs.utimesSync(path.join(dir, 'pkg/src/cli.ts'), past, past)
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		expect(run('pkg/skills/demo/scripts/demo.mjs', []).stderr).toBe('')
	})

	it('does not warn when the bin imports nothing outside its folder, so the output is unknown', () => {
		checkout('pkg')
		write('pkg/src/cli.ts', '')
		const past = new Date(Date.now() - 60_000)
		fs.utimesSync(path.join(dir, 'pkg/bin/demo.mjs'), past, past)
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		expect(run('pkg/skills/demo/scripts/demo.mjs', []).stderr).toBe('')
	})

	it('runs the pinned package through npx when copied out of any checkout', () => {
		forwarder('copy/demo.mjs', demo)

		const result = run('copy/demo.mjs', ['a', 'b c', 'x&y'])

		expect(result.stdout).toEqual({ npx: ['-y', 'demo-pkg@1.2.0', 'a', 'b c', 'x&y'] })
		expect(result.status).toBe(7)
	})

	// On Windows this goes through npx.cmd and cmd.exe, whose quoting the forwarder has to get right.
	it('passes arguments cmd.exe would reinterpret through npx unchanged', () => {
		forwarder('copy/demo.mjs', demo)
		const args = [
			'two words',
			'say "hi"',
			'"',
			'a&b',
			'a && b',
			'caret^',
			'100%',
			'%PATH%',
			'!bang!',
			'pipe|x',
			'<in>',
			'(paren)',
			'semi;colon,comma',
			'star*?',
			'trail\\',
			'back\\"slash',
			'',
		]

		const result = run('copy/demo.mjs', args)

		expect(result.stdout).toEqual({ npx: ['-y', 'demo-pkg@1.2.0', ...args] })
		expect(result.status).toBe(7)
	})

	it('passes stdin, stdout and stderr through npx', () => {
		write(
			'fake-bin/fake-npx.mjs',
			"import * as fs from 'node:fs'\nprocess.stderr.write('to stderr')\nconsole.log(JSON.stringify({ stdin: fs.readFileSync(0, 'utf8') }))\nprocess.exit(5)\n",
		)
		forwarder('copy/demo.mjs', demo)

		const result = run('copy/demo.mjs', [], 'from stdin\n')

		expect(result.stdout).toEqual({ stdin: 'from stdin\n' })
		expect(result.stderr).toBe('to stderr')
		expect(result.status).toBe(5)
	})

	it('runs a package.json of another name as no checkout', () => {
		write('pkg/package.json', JSON.stringify({ name: 'something-else', bin: { demo: 'bin/demo.mjs' } }))
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		expect(run('pkg/skills/demo/scripts/demo.mjs', ['a']).stdout).toEqual({ npx: ['-y', 'demo-pkg@1.2.0', 'a'] })
	})

	it("runs another package's CLI at its pinned version through npx, inside the own checkout", () => {
		checkout('pkg')
		forwarder('pkg/skills/demo/scripts/other-cli.mjs', {
			package: 'other-pkg',
			bin: 'other-cli',
			version: '3.4.5',
			forward: 'pinned',
		})

		expect(run('pkg/skills/demo/scripts/other-cli.mjs', ['x']).stdout).toEqual({
			npx: ['-y', 'other-pkg@3.4.5', 'x'],
		})
	})
})
