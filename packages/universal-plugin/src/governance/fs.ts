import * as fs from 'node:fs'
import * as path from 'node:path'

export interface GovernanceFs {
	exists(filePath: string): boolean
	read(filePath: string): string
	list(dir: string): string[]
}

export const realGovernanceFs: GovernanceFs = {
	exists: (p) => fs.existsSync(p),
	read: (p) => fs.readFileSync(p, 'utf8'),
	list: (dir) => {
		if (!fs.existsSync(dir)) return []
		return fs
			.readdirSync(dir)
			.filter((f) => f.endsWith('.md'))
			.map((f) => f.slice(0, -3))
	},
}

/** What the governance copy step needs from the filesystem, over and above reading a document:
 *  it walks a skill's declaration folder, resolves an owning package, and writes the copies. */
export interface GovernanceCopyFs extends GovernanceFs {
	/** True when `dir` is an existing directory. */
	isDirectory(dir: string): boolean
	write(filePath: string, content: string): void
}

export const realGovernanceCopyFs: GovernanceCopyFs = {
	...realGovernanceFs,
	isDirectory: (dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory(),
	write: (filePath, content) => {
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, content)
	},
}
