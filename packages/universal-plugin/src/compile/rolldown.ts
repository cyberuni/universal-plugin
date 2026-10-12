import { isBuiltin } from 'node:module'
import * as path from 'node:path'
import type { ScriptCompiler } from './scripts.js'
import { explainTsconfigFailure, failedExtends } from './tsconfig-diagnosis.js'

/** Compiles an entry with rolldown, the engine under tsdown. Node built-ins stay imports; everything
 *  else is inlined, so the file runs from a skill folder with no `node_modules` beside it.
 *
 *  An entry that inlines only its own source keeps readable output — in effect its types are
 *  stripped. One that inlines a dependency is minified, because that is the code the size budget is
 *  for. rolldown is loaded only when a plugin declares a script. */
export const rolldownCompiler: ScriptCompiler = {
	async compile(sourcePath, root) {
		const { rolldown } = await import('rolldown')
		const unresolved: string[] = []
		const bundle = await rolldown({
			input: sourcePath,
			cwd: root,
			platform: 'node',
			// An import rolldown cannot resolve would stay an import — a script that fails in the skill
			// folder — so it fails the compile. Every other log is rolldown's to keep to itself.
			onLog(_level, log) {
				if (log.code === 'UNRESOLVED_IMPORT') unresolved.push(log.message)
			},
		})
		try {
			if (unresolved.length > 0) throw new Error(unresolved.join('\n'))
			const readable = await bundle.generate({ format: 'esm', codeSplitting: false })
			const [chunk, ...rest] = readable.output
			if (chunk?.type !== 'chunk' || rest.some((o) => o.type === 'chunk')) {
				throw new Error('compiles to more than one file')
			}
			const external = [...chunk.imports, ...chunk.dynamicImports].filter((id) => !isBuiltin(id))
			if (external.length > 0)
				throw new Error(
					`imports ${external.join(', ')}, which could not be inlined — install it where the plugin root resolves it`,
				)
			const inlinesDependency = chunk.moduleIds.some((id) => id.split(path.sep).includes('node_modules'))
			if (!inlinesDependency) return chunk.code
			const minified = await bundle.generate({ format: 'esm', codeSplitting: false, minify: true })
			return (minified.output[0] as { code: string }).code
		} catch (error) {
			// rolldown's message names the `extends` it could not load but not the file declaring it.
			const spec = failedExtends(error)
			throw spec ? new Error(explainTsconfigFailure(sourcePath, root, spec), { cause: error }) : error
		} finally {
			await bundle.close()
		}
	},
}
