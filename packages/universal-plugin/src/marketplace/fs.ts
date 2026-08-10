import * as fs from 'node:fs'
import * as path from 'node:path'

export interface MarketplaceFs {
	exists(file: string): boolean
	isDirectory(file: string): boolean
	read(file: string): string
	listFiles(dir: string): string[]
	writeAtomically(file: string, content: string): void
}

export const realMarketplaceFs: MarketplaceFs = {
	exists: fs.existsSync,
	isDirectory(file) {
		return fs.statSync(file).isDirectory()
	},
	read(file) {
		return fs.readFileSync(file, 'utf8')
	},
	listFiles(dir) {
		return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
			const child = path.join(dir, entry.name)
			if (entry.isDirectory()) return this.listFiles(child)
			return entry.isFile() && entry.name === 'plugin.json' ? [child] : []
		})
	},
	writeAtomically(file, content) {
		fs.mkdirSync(path.dirname(file), { recursive: true })
		const temporary = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
		fs.writeFileSync(temporary, content)
		fs.renameSync(temporary, file)
	},
}
