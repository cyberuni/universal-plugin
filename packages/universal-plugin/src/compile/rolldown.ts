import { isBuiltin } from 'node:module'
import * as path from 'node:path'
import type { Plugin } from 'rolldown'
import { escapeInvisible, isInvisible, type LiteralSpan } from './invisible.js'
import { neutralizeMainGuards } from './main-guard.js'
import type { ScriptBundleOptions, ScriptCompiler } from './scripts.js'
import { explainTsconfigFailure, failedExtends } from './tsconfig-diagnosis.js'

/** Keeps only the entry's main guard, so an entry that imports another script runs one CLI. */
function onlyEntryMain(): Plugin {
	return {
		name: 'universal-plugin:only-entry-main',
		transform(code, id) {
			if (this.getModuleInfo(id)?.isEntry) return null
			const out = neutralizeMainGuards(code)
			return out === undefined ? null : { code: out }
		},
	}
}

/** Compiles an entry with rolldown, the engine under tsdown. Node built-ins stay imports; everything
 *  else is inlined, so the file runs from a skill folder with no `node_modules` beside it.
 *
 *  An entry that inlines only its own source keeps readable output — in effect its types are
 *  stripped. One that inlines a dependency is minified, because that is the code the size budget is
 *  for. rolldown is loaded only when a plugin declares a script.
 *
 *  An entry's `alias` becomes `resolve.alias`, with a relative target resolved from the plugin root;
 *  its `keepNames` is passed to both outputs, so minifying keeps the names too. */
export const rolldownCompiler: ScriptCompiler = {
	async compile(sourcePath, root, options = {}) {
		const { rolldown } = await import('rolldown')
		const unresolved: string[] = []
		const alias = resolveAlias(options, root)
		const output = { format: 'esm', codeSplitting: false, keepNames: options.keepNames ?? false } as const
		const bundle = await rolldown({
			input: sourcePath,
			cwd: root,
			platform: 'node',
			plugins: [onlyEntryMain()],
			...(alias === undefined ? {} : { resolve: { alias } }),
			// An import rolldown cannot resolve would stay an import — a script that fails in the skill
			// folder — so it fails the compile. Every other log is rolldown's to keep to itself.
			onLog(_level, log) {
				if (log.code === 'UNRESOLVED_IMPORT') unresolved.push(log.message)
			},
		})
		try {
			if (unresolved.length > 0) throw new Error(unresolved.join('\n'))
			const readable = await bundle.generate(output)
			const [chunk, ...rest] = readable.output
			if (chunk?.type !== 'chunk' || rest.some((o) => o.type === 'chunk')) {
				throw new Error('compiles to more than one file')
			}
			// A dynamic import of a module the chunk already inlines is listed as the chunk itself; the code
			// resolves it in place. An `import(variable)` is not listed at all: it is left to run time.
			const external = [...chunk.imports, ...chunk.dynamicImports].filter(
				(id) => !isBuiltin(id) && id !== chunk.fileName,
			)
			if (external.length > 0)
				throw new Error(
					`imports ${external.join(', ')}, which could not be inlined — install it where the plugin root resolves it`,
				)
			const inlinesDependency = chunk.moduleIds.some((id) => id.split(path.sep).includes('node_modules'))
			if (!inlinesDependency) return await escapeLiterals(chunk.code)
			const minified = await bundle.generate({ ...output, minify: true })
			return await escapeLiterals((minified.output[0] as { code: string }).code)
		} catch (error) {
			// rolldown's message names the `extends` it could not load but not the file declaring it.
			const spec = failedExtends(error)
			throw spec ? new Error(explainTsconfigFailure(sourcePath, root, spec), { cause: error }) : error
		} finally {
			await bundle.close()
		}
	},
}

/** The entry's alias with each relative target (`./`, `../`) made absolute from the plugin root, so it
 *  does not depend on where rolldown resolves from; `undefined` when the entry sets none. */
function resolveAlias({ alias }: ScriptBundleOptions, root: string): Record<string, string> | undefined {
	if (alias === undefined || Object.keys(alias).length === 0) return undefined
	return Object.fromEntries(
		Object.entries(alias).map(([from, to]) => [from, /^\.\.?\//.test(to) ? path.resolve(root, to) : to]),
	)
}

/** rolldown prints a dependency's escaped invisible characters raw (issue #190); this writes them back
 *  as escapes inside every string, untagged template and regular-expression literal. */
async function escapeLiterals(code: string): Promise<string> {
	if (![...code].some(isInvisible)) return code
	const { parseAst } = await import('rolldown/parseAst')
	const spans: LiteralSpan[] = []
	collectSpans(parseAst(code) as unknown as AstNode, spans)
	return escapeInvisible(code, spans)
}

interface AstNode {
	type: string
	start: number
	end: number
	[key: string]: unknown
}

function isNode(value: unknown): value is AstNode {
	return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string'
}

function collectSpans(node: AstNode, spans: LiteralSpan[]): void {
	if (node.type === 'Literal') {
		if (typeof node['value'] === 'string') spans.push({ start: node.start, end: node.end, kind: 'string' })
		else if (node['regex'] !== undefined) spans.push({ start: node.start, end: node.end, kind: 'regex' })
		return
	}
	// A tag can read a template's raw text, which an escape would change, so its quasis stay as written.
	if (node.type === 'TaggedTemplateExpression') {
		visit(node['tag'], spans)
		for (const expression of (node['quasi'] as AstNode)['expressions'] as AstNode[]) collectSpans(expression, spans)
		return
	}
	if (node.type === 'TemplateElement') {
		spans.push({ start: node.start, end: node.end, kind: 'template' })
		return
	}
	for (const [key, value] of Object.entries(node)) {
		if (key !== 'parent') visit(value, spans)
	}
}

function visit(value: unknown, spans: LiteralSpan[]): void {
	if (Array.isArray(value)) for (const item of value) visit(item, spans)
	else if (isNode(value)) collectSpans(value, spans)
}
