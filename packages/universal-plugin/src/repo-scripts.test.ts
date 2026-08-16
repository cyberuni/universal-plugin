import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

/** The CLI serializes manifests with `JSON.stringify`. How JSON *looks* in a repo is that repo's
 *  call, not the CLI's — biome here formats `package.json` at lineWidth 20 and every other JSON at
 *  120, and a consumer repo may use prettier, two spaces, or no formatter at all — so no writer can
 *  encode one right answer. The consumer repo formats after the CLI writes. Concretely: every root
 *  script that runs a manifest-writing verb must end in a format step, or the next `biome check .`
 *  fails on the file the script just wrote (which is how the release PR went red). */
const WRITE_VERBS = ['plugin build', 'plugin init', 'plugin version', 'publish sync-version']
const FORMAT_STEPS = ['pnpm check', 'biome check --write', 'biome format']

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../../..')
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
	private?: boolean
	scripts: Record<string, string>
}

/** Root scripts compose: `version` delegates its build-and-format tail to `plugin:build`. Inline the
 *  referenced script so both the write verb and the format step are visible in one string — a script
 *  that formats via a script that formats still formats. */
function expand(command: string, seen: ReadonlySet<string> = new Set()): string {
	return command.replace(/pnpm ([\w:]+)/g, (reference, name: string) => {
		const referenced = rootPackageJson.scripts[name]
		if (!referenced || seen.has(name)) return reference
		return expand(referenced, new Set([...seen, name]))
	})
}

const writingScripts = Object.entries(rootPackageJson.scripts)
	.map(([name, command]) => [name, expand(command)] as const)
	.filter(([, command]) => WRITE_VERBS.some((verb) => command.includes(verb)))

it('resolves the workspace root package.json', () => {
	expect(rootPackageJson.private).toBe(true)
	// A rename that empties this list would turn every case below into a silent pass.
	expect(writingScripts.map(([name]) => name)).toEqual(['plugin:build', 'version'])
})

it.each(writingScripts)('root script `%s` formats the JSON it writes', (_name, command) => {
	expect(FORMAT_STEPS.some((step) => command.includes(step))).toBe(true)
})
