import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

// Issue #250: `import()` reads a Windows path such as `D:\a\x.mjs` as a URL with the scheme `d:`, which
// Node's ESM loader rejects. A launcher that imports a file must pass a `file://` URL, never a path.

test('a Windows path is not a valid import specifier until it is a file URL', () => {
	expect(new URL('D:\\a\\repo\\dist\\cli.mjs').protocol).toBe('d:')
	const href = pathToFileURL('D:\\a\\repo\\dist\\cli.mjs', { windows: true }).href
	expect(href).toBe('file:///D:/a/repo/dist/cli.mjs')
	expect(new URL(href).protocol).toBe('file:')
})

const binDir = path.resolve('bin')
const launchers = fs.readdirSync(binDir).filter((f) => f.endsWith('.mjs'))

test.each(launchers)('bin/%s imports a file only through a file URL', (file) => {
	const source = fs.readFileSync(path.join(binDir, file), 'utf8')
	const calls = [...source.matchAll(/\bawait import\((.*)\)/g)].map((m) => m[1] as string)
	for (const arg of calls) {
		// A quoted package specifier resolves through node_modules; anything else is a computed path.
		if (/^(['"])[^./][^'"]*\1$/.test(arg)) continue
		expect(arg, `bin/${file}: import(${arg})`).toMatch(/^pathToFileURL\(.*\)\.href$/)
	}
})
