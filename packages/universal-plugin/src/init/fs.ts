import * as fs from 'node:fs'
import * as path from 'node:path'

import { detectIndent } from '../json.js'
import type { InitPlan, InitState } from './init.js'

/** Gathers the filesystem state `planInit` needs and applies the plan it returns. The manifest is
 *  written tab-indented (the repo default); `package.json` keeps its own indentation. */
export interface InitFs {
	gather(root: string): InitState
	apply(root: string, plan: InitPlan): void
}

function manifestPath(root: string): string {
	return path.join(root, 'plugin.json')
}

function packageJsonPath(root: string): string {
	return path.join(root, 'package.json')
}

export const realInitFs: InitFs = {
	gather(root) {
		const pj = packageJsonPath(root)
		const packageJson = fs.existsSync(pj) ? (JSON.parse(fs.readFileSync(pj, 'utf8')) as Record<string, unknown>) : null
		return { manifestExists: fs.existsSync(manifestPath(root)), packageJson }
	},
	apply(root, plan) {
		fs.writeFileSync(manifestPath(root), `${JSON.stringify(plan.manifest, null, '\t')}\n`)
		for (const dir of plan.dirs) {
			fs.mkdirSync(path.join(root, dir), { recursive: true })
		}
		if (plan.packageJson) {
			const pj = packageJsonPath(root)
			const indent = detectIndent(fs.readFileSync(pj, 'utf8'))
			fs.writeFileSync(pj, `${JSON.stringify(plan.packageJson, null, indent)}\n`)
		}
	},
}
