import * as fs from 'node:fs'
import * as path from 'node:path'

const failedTsconfig = /Failed to load tsconfig '([^']+)'/

/** The `extends` specifier rolldown could not load, or undefined when the error is not a tsconfig
 *  failure. */
export function failedExtends(error: unknown): string | undefined {
	return failedTsconfig.exec(error instanceof Error ? error.message : String(error))?.[1]
}

function readTsconfig(file: string): { extends?: string | string[]; references?: { path: string }[] } | undefined {
	try {
		// tsconfig is JSONC: drop comments and trailing commas before parsing.
		const text = fs
			.readFileSync(file, 'utf8')
			.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str) => str ?? '')
			.replace(/,(\s*[}\]])/g, '$1')
		return JSON.parse(text)
	} catch {
		return undefined
	}
}

function referenceFile(from: string, ref: string): string {
	const target = path.resolve(path.dirname(from), ref)
	return target.endsWith('.json') ? target : path.join(target, 'tsconfig.json')
}

function localExtends(from: string, spec: string): string | undefined {
	for (const candidate of [spec, `${spec}.json`]) {
		const file = path.resolve(path.dirname(from), candidate)
		if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
	}
	return undefined
}

/** Finds the tsconfig file that declares `spec` in `extends`, walking the tsconfig the entry falls
 *  under: its `extends` chain and its project `references`. */
export function findExtendsOwner(entry: string, spec: string): string | undefined {
	let dir = path.dirname(entry)
	let start: string | undefined
	for (;;) {
		const candidate = path.join(dir, 'tsconfig.json')
		if (fs.existsSync(candidate)) {
			start = candidate
			break
		}
		const parent = path.dirname(dir)
		if (parent === dir) return undefined
		dir = parent
	}
	const seen = new Set<string>()
	const visit = (file: string): string | undefined => {
		if (seen.has(file)) return undefined
		seen.add(file)
		const config = readTsconfig(file)
		if (!config) return undefined
		const extended = [config.extends ?? []].flat()
		if (extended.includes(spec)) return file
		for (const e of extended) {
			const next = e.startsWith('.') ? localExtends(file, e) : undefined
			const found = next && visit(next)
			if (found) return found
		}
		for (const ref of config.references ?? []) {
			const found = visit(referenceFile(file, ref.path))
			if (found) return found
		}
		return undefined
	}
	return visit(start)
}

/** Explains a tsconfig failure: names the file and the `extends` path, and the usual fix. */
export function explainTsconfigFailure(entry: string, root: string, spec: string): string {
	const owner = findExtendsOwner(entry, spec)
	const where = owner ? `${path.relative(root, owner) || path.basename(owner)} extends` : 'a tsconfig extends'
	const hint = spec.endsWith('.json')
		? ''
		: ' Add the `.json` extension to it: rolldown, unlike tsc, does not resolve an `extends` without one.'
	return `${where} "${spec}", which rolldown could not load.${hint}`
}
