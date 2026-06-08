import * as fs from 'node:fs'
import * as path from 'node:path'

export interface SyncVersionResult {
	version: string
	manifestPath: string
}

export function syncVersion(root: string): SyncVersionResult {
	const manifestPath = path.join(root, '.plugin', 'plugin.json')
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`No .plugin/plugin.json found at ${root}`)
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>

	const packagePath = manifest['packagePath']
	if (!packagePath || typeof packagePath !== 'string') {
		throw new Error('packagePath is required in .plugin/plugin.json')
	}

	const pkgJsonPath = path.join(root, packagePath, 'package.json')
	if (!fs.existsSync(pkgJsonPath)) {
		throw new Error(`No package.json found at ${packagePath}`)
	}

	const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>
	const version = pkg['version']
	if (!version || typeof version !== 'string') {
		throw new Error(`No version found in ${packagePath}/package.json`)
	}

	const updated = { ...manifest, version }
	fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, '\t')}\n`)

	return { version, manifestPath }
}
