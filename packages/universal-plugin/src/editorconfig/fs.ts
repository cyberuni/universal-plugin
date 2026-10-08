import * as fs from 'node:fs'
import * as path from 'node:path'

import { type EditorconfigFile, editorconfigIndent, parseEditorconfig } from './editorconfig.js'

/** Reads the `.editorconfig` files above `filePath`, nearest first, up to the one marked
 *  `root = true` or the filesystem root, and returns the indentation they set for it — `undefined`
 *  when none sets `indent_style`. The file itself need not exist yet. */
export function readEditorconfigIndent(filePath: string): string | number | undefined {
	const target = path.resolve(filePath)
	const found: { config: EditorconfigFile; relativePath: string }[] = []
	let dir = path.dirname(target)
	for (;;) {
		const candidate = path.join(dir, '.editorconfig')
		if (fs.existsSync(candidate)) {
			const config = parseEditorconfig(fs.readFileSync(candidate, 'utf8'))
			found.unshift({ config, relativePath: path.relative(dir, target).split(path.sep).join('/') })
			if (config.root) break
		}
		const parent = path.dirname(dir)
		if (parent === dir) break
		dir = parent
	}
	return editorconfigIndent(found)
}
