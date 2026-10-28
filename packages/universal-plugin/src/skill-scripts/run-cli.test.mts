import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

/** The launchers are the compiled `run-cli` entry, one per command. Each is copied out of the package
 *  here, the way pnpm's copy fallback leaves a skill, and run against fake `pnpm` and `npx`. */
const launcher = (name: string) => path.resolve('skills', name)

let dir: string
let log: string

beforeEach(() => {
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-launcher-')))
	log = path.join(dir, 'calls.log')
})
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
})

function fake(name: string, script: string) {
	fs.mkdirSync(path.join(dir, 'bin'), { recursive: true })
	fs.writeFileSync(path.join(dir, 'bin', name), `#!/bin/sh\n${script}\n`, { mode: 0o755 })
}

function run(skillScript: string, ...args: string[]) {
	const copy = path.join(dir, '.claude/skills/copied/scripts', path.basename(skillScript))
	fs.mkdirSync(path.dirname(copy), { recursive: true })
	fs.copyFileSync(launcher(skillScript), copy)
	spawnSync('node', [copy, ...args], {
		encoding: 'utf8',
		env: { ...process.env, PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}` },
	})
	return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []
}

const own = () => JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { version: string }

test('a copied launcher runs its command through the project’s installed CLI', () => {
	fake('pnpm', `echo "pnpm $@" >> ${log}`)
	fake('npx', `echo "npx $@" >> ${log}`)

	expect(run('build-plugin/scripts/build.mjs', '--root', 'x')).toEqual([
		'pnpm exec universal-plugin --version',
		'pnpm exec universal-plugin plugin build --root x',
	])
})

test('a copied launcher with no installed CLI runs the pinned npx fallback', () => {
	fake('pnpm', 'exit 1')
	fake('npx', `echo "npx $@" >> ${log}`)

	expect(run('marketplace/scripts/validate.mjs', '--root', 'x')).toEqual([
		`npx universal-plugin@${own().version} marketplace validate --root x`,
	])
})

test('each launcher runs the command it is declared for', () => {
	fake('pnpm', `echo "$@" >> ${log}`)
	const commands = {
		'build-plugin/scripts/build.mjs': 'plugin build',
		'init-universal-plugin/scripts/init.mjs': 'plugin init',
		'version/scripts/version.mjs': 'plugin version',
		'marketplace/scripts/add.mjs': 'marketplace add',
		'marketplace/scripts/marketplace.mjs': 'marketplace init',
		'marketplace/scripts/update.mjs': 'marketplace update',
		'marketplace/scripts/validate.mjs': 'marketplace validate',
	}
	for (const [script, command] of Object.entries(commands)) {
		fs.rmSync(log, { force: true })
		expect(run(script).at(-1)).toBe(`exec universal-plugin ${command}`)
	}
})
