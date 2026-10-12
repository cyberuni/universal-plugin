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

	it('rejects an entry with an import that cannot be inlined', async () => {
		write('src/a.ts', "import x from 'not-installed'\nconsole.log(x)\n")
		await expect(rolldownCompiler.compile(path.join(dir, 'src/a.ts'), dir)).rejects.toThrow(/not-installed/)
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
