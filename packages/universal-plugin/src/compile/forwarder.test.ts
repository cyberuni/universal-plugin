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

function run(rel: string, args: string[]) {
	const result = spawnSync(process.execPath, [path.join(dir, rel), ...args], {
		encoding: 'utf8',
		env: { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env['PATH'] ?? ''}` },
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

	it('warns when the build output is older than src, and still runs the bin', () => {
		checkout('pkg')
		write('pkg/dist/cli.mjs', '')
		write('pkg/src/cli.ts', '')
		const past = new Date(Date.now() - 60_000)
		fs.utimesSync(path.join(dir, 'pkg/dist/cli.mjs'), past, past)
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		const result = run('pkg/skills/demo/scripts/demo.mjs', ['x'])

		expect(result.stderr).toMatch(/dist in .* is older than src\//)
		expect(result.stdout).toEqual({ bin: ['x'] })
	})

	it('does not warn when the build output is newer than src', () => {
		checkout('pkg')
		write('pkg/src/cli.ts', '')
		write('pkg/dist/cli.mjs', '')
		const past = new Date(Date.now() - 60_000)
		fs.utimesSync(path.join(dir, 'pkg/src/cli.ts'), past, past)
		forwarder('pkg/skills/demo/scripts/demo.mjs', demo)

		expect(run('pkg/skills/demo/scripts/demo.mjs', []).stderr).toBe('')
	})

	it('runs the pinned package through npx when copied out of any checkout', () => {
		forwarder('copy/demo.mjs', demo)

		const result = run('copy/demo.mjs', ['a', 'b c', 'x&y'])

		expect(result.stdout).toEqual({ npx: ['-y', 'demo-pkg@1.2.0', 'a', 'b c', 'x&y'] })
		expect(result.status).toBe(7)
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
