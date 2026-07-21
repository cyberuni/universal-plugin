import * as fs from 'node:fs'
import * as path from 'node:path'

import { detectIndent } from '../json.js'
import type { ConfigFile } from './config.js'

/** Reads and writes the repo-root `.agents/universal-plugin.json`, preserving the
 *  file's existing indentation and every top-level key the domain does not touch. */
export interface ConfigFs {
	/** Parse the config file; an absent file reads as `{}`. */
	read(root: string): ConfigFile
	/** Serialize `config` back to the file, creating it (and `.agents/`) if absent. */
	write(root: string, config: ConfigFile): void
}

function configPath(root: string): string {
	return path.join(root, '.agents', 'universal-plugin.json')
}

export const realConfigFs: ConfigFs = {
	read(root) {
		const file = configPath(root)
		if (!fs.existsSync(file)) return {}
		return JSON.parse(fs.readFileSync(file, 'utf8')) as ConfigFile
	},
	write(root, config) {
		const file = configPath(root)
		const indent = fs.existsSync(file) ? detectIndent(fs.readFileSync(file, 'utf8')) : '\t'
		fs.mkdirSync(path.dirname(file), { recursive: true })
		fs.writeFileSync(file, `${JSON.stringify(config, null, indent)}\n`)
	},
}
