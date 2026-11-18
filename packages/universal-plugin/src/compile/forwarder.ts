/** CLI forwarders (ADR-0022) — the file a `forward` entry writes, with no I/O.
 *
 *  A forwarder holds none of the CLI's code. It finds the CLI at run time: the checkout it sits in,
 *  when it sits in one of the package, else the package pinned to the embedded version through `npx`.
 *  It carries the same header a compiled script does, so `plugin build --check`, `plugin version` and
 *  `publish check-version` read it the same way. */

import { SCRIPT_GLOBAL, type ScriptData } from './scripts.js'

const DATA_PREFIX = `globalThis.${SCRIPT_GLOBAL} = `

/** The forwarder's run-time code. Plain JavaScript that imports only Node built-ins, so it runs from
 *  any copy of the skill folder, on every platform, with `node <path>`. */
const BODY = `import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const { package: pkg, bin, version } = globalThis.${SCRIPT_GLOBAL}
const args = process.argv.slice(2)
const checkout = findCheckout(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))))
const result = checkout === null ? runNpx() : runCheckout(checkout)
if (result.error) {
	process.stderr.write(\`\${bin}: \${result.error.message}\\n\`)
	process.exit(1)
}
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)

/** The nearest package.json above this file, from its real path, that is the package and ships the
 *  CLI: a checkout under development, or the installed package a symlinked skill resolves into. */
function findCheckout(dir) {
	for (;;) {
		const json = readJson(path.join(dir, 'package.json'))
		const target = json?.name === pkg ? binPath(json.bin) : null
		if (target) return { dir, target: path.resolve(dir, target) }
		const parent = path.dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}

function binPath(declared) {
	if (typeof declared === 'string') return pkg.replace(/^@[^/]+\\//, '') === bin ? declared : null
	if (declared && typeof declared === 'object' && typeof declared[bin] === 'string') return declared[bin]
	return null
}

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch {
		return null
	}
}

function runCheckout({ dir, target }) {
	const src = path.join(dir, 'src')
	if (fs.existsSync(src)) {
		const dist = path.join(dir, 'dist')
		const built = newest(fs.existsSync(dist) ? dist : target)
		if (newest(src) > built) {
			const output = path.relative(dir, fs.existsSync(dist) ? dist : target) || target
			process.stderr.write(\`\${bin}: \${output} in \${dir} is older than src/ — rebuild to run your change\\n\`)
		}
	}
	return spawnSync(process.execPath, [target, ...args], { stdio: 'inherit' })
}

/** The newest modification time under a path, skipping node_modules; 0 when it does not exist. */
function newest(p) {
	let stat
	try {
		stat = fs.statSync(p)
	} catch {
		return 0
	}
	if (!stat.isDirectory()) return stat.mtimeMs
	let max = 0
	for (const entry of fs.readdirSync(p)) {
		if (entry !== 'node_modules') max = Math.max(max, newest(path.join(p, entry)))
	}
	return max
}

function runNpx() {
	const npxArgs = ['-y', \`\${pkg}@\${version}\`, ...args]
	if (process.platform !== 'win32') return spawnSync('npx', npxArgs, { stdio: 'inherit' })
	// npx is a .cmd shim on Windows, which only the shell runs; quote each argument for cmd.exe.
	return spawnSync(['npx.cmd', ...npxArgs.map(quoteForCmd)].join(' '), { stdio: 'inherit', shell: true })
}

function quoteForCmd(arg) {
	const quoted = \`"\${arg.replace(/(\\\\*)"/g, '$1$1\\\\"').replace(/(\\\\*)$/, '$1$1')}"\`
	return quoted.replace(/([()\\][%!^"\`<>&|;, *?])/g, '^$1').replace(/([()\\][%!^"\`<>&|;, *?])/g, '^$1')
}
`

/** The forwarder file: the header, then the run-time code. No hashbang: a skill runs it with `node`. */
export function composeForwarder(data: ScriptData & { package: string; bin: string; version: string }): string {
	const header = `// Written by \`universal-plugin plugin build\` to forward to the ${data.bin} CLI of ${data.package}. Edit plugin.json, not this file.\n${DATA_PREFIX}${JSON.stringify(data)};\n`
	return `${header}${BODY}`
}
