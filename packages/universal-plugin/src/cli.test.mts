import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

const bin = path.resolve('bin/universal-plugin.mjs')
const ownVersion = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).version as string

function run(cwd: string, ...args: string[]) {
	return spawnSync('node', [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } })
}

let emptyDir: string
beforeEach(() => {
	emptyDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-clitest-')))
})
afterEach(() => {
	fs.rmSync(emptyDir, { recursive: true, force: true })
})

test('--version reports the installed package version, not a placeholder', () => {
	const r = run(process.cwd(), '--version')
	expect(r.status).toBe(0)
	expect(r.stdout.trim()).toBe(ownVersion)
	expect(r.stdout.trim()).not.toBe('0.0.0')
})

test('-V is the same as --version', () => {
	const r = run(process.cwd(), '-V')
	expect(r.status).toBe(0)
	expect(r.stdout.trim()).toBe(ownVersion)
})

test('--version is independent of the working directory and any target plugin.json', () => {
	const r = run(emptyDir, '--version')
	expect(r.status).toBe(0)
	expect(r.stdout.trim()).toBe(ownVersion)
})
