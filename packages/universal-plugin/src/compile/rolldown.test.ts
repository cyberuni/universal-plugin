import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { rolldownCompiler } from './rolldown.js'

let dir: string

beforeEach(() => {
	dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-rolldown-')))
})
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true })
})

function write(rel: string, content: string) {
	fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
	fs.writeFileSync(path.join(dir, rel), content)
}

describe('rolldownCompiler', () => {
	it('strips the types of an entry that imports only Node built-ins and its own files, readably', async () => {
		write(
			'src/a.ts',
			"import * as fs from 'node:fs'\nimport { b } from './b.js'\nconst n: number = 1\nconsole.log(fs.existsSync('.'), b(n))\n",
		)
		write('src/b.ts', 'export function b(n: number): string {\n\treturn "n=" + n\n}\n')

		const code = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)

		expect(code).toContain('import * as fs from "node:fs"')
		expect(code).toContain('function b(n) {')
		expect(code).not.toContain(': number')
		expect(code).not.toContain(dir)
	})

	it('inlines and minifies a dependency', async () => {
		write('node_modules/tiny/package.json', JSON.stringify({ name: 'tiny', type: 'module', main: 'index.js' }))
		write('node_modules/tiny/index.js', 'export function shout(s) {\n\treturn s.toUpperCase()\n}\n')
		write('src/a.ts', "import { shout } from 'tiny'\nconsole.log(shout('x'))\n")

		const code = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)

		expect(code).not.toContain("from 'tiny'")
		expect(code).not.toContain('from "tiny"')
		expect(code).toContain('toUpperCase')
		expect(code.split('\n').filter(Boolean).length).toBe(1)
	})

	it("runs only the entry's CLI when the entry imports another script that has its own (issue #192)", async () => {
		const guard = 'process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href'
		const head = "import { realpathSync } from 'node:fs'\nimport { pathToFileURL } from 'node:url'\n"
		write('src/lib.ts', `${head}export const name: string = 'lib'\nif (${guard}) console.log('lib cli ran')\n`)
		write('src/a.ts', `${head}import { name } from './lib.js'\nif (${guard}) console.log('a cli ran with ' + name)\n`)

		const code = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)
		write('out/a.mjs', code)
		const stdout = execFileSync(process.execPath, [path.join(dir, 'out/a.mjs'), '--help'], { encoding: 'utf8' })

		expect(stdout).toBe('a cli ran with lib\n')
	})

	it('rejects an entry with an import that cannot be inlined', async () => {
		write('src/a.ts', "import x from 'not-installed'\nconsole.log(x)\n")
		await expect(rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)).rejects.toThrow(/not-installed/)
	})

	it('compiles a dependency that imports a variable, leaving the import to run time (#187)', async () => {
		write('node_modules/loader/package.json', JSON.stringify({ name: 'loader', type: 'module', main: 'index.js' }))
		write('node_modules/loader/index.js', 'export function load(id) {\n\treturn import(id)\n}\n')
		write('src/a.ts', "import { load } from 'loader'\nconst m = await load('node:path')\nconsole.log(typeof m.join)\n")

		const code = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)

		expect(code).toMatch(/import\(\w+\)/)
		write('out/a.mjs', code)
		expect(execFileSync(process.execPath, [path.join(dir, 'out/a.mjs')], { encoding: 'utf8' })).toBe('function\n')
	})

	it('compiles a dependency that dynamically imports a module the chunk already inlines (#187)', async () => {
		write('node_modules/loader/package.json', JSON.stringify({ name: 'loader', type: 'module', main: 'index.js' }))
		write(
			'node_modules/loader/index.js',
			"export function name() {\n\treturn 'loader'\n}\nexport function self() {\n\treturn import('./index.js')\n}\n",
		)
		write('src/a.ts', "import { self } from 'loader'\nconsole.log((await self()).name())\n")

		const code = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)

		write('out/a.mjs', code)
		expect(execFileSync(process.execPath, [path.join(dir, 'out/a.mjs')], { encoding: 'utf8' })).toBe('loader\n')
	})

	it('resolves an import through the entry alias, to a package or a path from the plugin root', async () => {
		write('node_modules/tiny/package.json', JSON.stringify({ name: 'tiny', type: 'module', main: 'cjs.js' }))
		write('node_modules/tiny/cjs.js', 'module.exports = { which: () => "cjs" }\n')
		write('node_modules/tiny/esm.js', 'export function which() {\n\treturn "esm"\n}\n')
		write('shims/missing.ts', 'export const shim = "shim"\n')
		write('src/a.ts', "import { which } from 'tiny'\nimport { shim } from 'missing'\nconsole.log(which(), shim)\n")

		const code = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir, {
			alias: { tiny: 'tiny/esm.js', missing: './shims/missing.ts' },
		})

		expect(code).not.toContain('module.exports')
		write('out/a.mjs', code)
		expect(execFileSync(process.execPath, [path.join(dir, 'out/a.mjs')], { encoding: 'utf8' })).toBe('esm shim\n')
	})

	it('keeps function and class names through minifying when the entry sets keepNames', async () => {
		write('node_modules/tiny/package.json', JSON.stringify({ name: 'tiny', type: 'module', main: 'index.js' }))
		write(
			'node_modules/tiny/index.js',
			'export function named() {\n\treturn 1\n}\nexport class Widget {}\nexport const names = () => [named.name, Widget.name].join(" ")\n',
		)
		write('src/a.ts', "import { names } from 'tiny'\nconsole.log(names())\n")
		const run = (code: string) => {
			write('out/a.mjs', code)
			return execFileSync(process.execPath, [path.join(dir, 'out/a.mjs')], { encoding: 'utf8' })
		}

		const kept = await rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir, { keepNames: true })

		expect(kept.split('\n').filter(Boolean).length).toBe(1)
		expect(run(kept)).toBe('named Widget\n')
	})

	it('names the tsconfig file and the extends path when rolldown cannot load one', async () => {
		write('tsconfig.json', JSON.stringify({ files: [], references: [{ path: './packages/a' }] }))
		write('packages/a/tsconfig.json', JSON.stringify({ extends: './tsconfig.esm' }))
		write('packages/a/tsconfig.esm.json', '{\n\t// shared base\n\t"extends": "shared-config/tsconfig/base",\n}\n')
		write('packages/a/src/a.ts', 'console.log(1)\n')

		await expect(rolldownCompiler.compile(path.join(dir, 'packages/a/src/a.ts'), dir)).rejects.toThrow(
			/packages\/a\/tsconfig\.esm\.json extends "shared-config\/tsconfig\/base".*\.json/,
		)
	})
})
