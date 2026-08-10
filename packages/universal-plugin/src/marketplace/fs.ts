import * as fs from 'node:fs'
import * as path from 'node:path'

export interface MarketplaceFs {
	exists(file: string): boolean
	isDirectory(file: string): boolean
	realpath(file: string): string
	read(file: string): string
	listEntries(dir: string): string[]
	writeAtomically(file: string, content: string): void
}

export const realMarketplaceFs: MarketplaceFs = {
	exists: fs.existsSync,
	isDirectory(file) {
		return fs.statSync(file).isDirectory()
	},
	realpath(file) {
		return fs.realpathSync(file)
	},
	read(file) {
		return fs.readFileSync(file, 'utf8')
	},
	listEntries(dir) {
		return fs.readdirSync(dir)
	},
	writeAtomically(file, content) {
		fs.mkdirSync(path.dirname(file), { recursive: true })
		const temporary = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
		fs.writeFileSync(temporary, content)
		fs.renameSync(temporary, file)
	},
}
