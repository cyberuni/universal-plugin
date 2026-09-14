import * as fs from 'node:fs'
import * as path from 'node:path'

import { VENDOR_OUTPUT } from '../build/build.js'
import { type ManifestValidation, validateCanonicalManifest } from './validation.js'

export interface ValidateOptions {
	vendor?: string
	strict?: boolean
}

export interface ValidateResult extends ManifestValidation {
	/** Vendor keys the manifest declares under `harnesses`, in authored order. */
	harnesses: string[]
}

const KNOWN_VENDORS: ReadonlySet<string> = new Set(Object.keys(VENDOR_OUTPUT))

/** Reads the root `plugin.json` under `root` and validates it. Throws when there is no manifest to
 *  check, when it is not JSON, or when `--vendor` names a vendor this CLI does not know. */
export function validatePlugin(root: string, opts: ValidateOptions = {}): ValidateResult {
	if (opts.vendor !== undefined && !KNOWN_VENDORS.has(opts.vendor)) {
		throw new Error(`Unknown vendor "${opts.vendor}" (expected one of: ${[...KNOWN_VENDORS].join(', ')})`)
	}

	const manifestPath = path.join(root, 'plugin.json')
	if (!fs.existsSync(manifestPath)) throw new Error(`No plugin.json found at ${root}`)

	let manifest: unknown
	try {
		manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
	} catch (err) {
		throw new Error(`plugin.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
	}

	const result = validateCanonicalManifest(manifest, { knownVendors: KNOWN_VENDORS, ...opts })
	return { ...result, harnesses: declaredHarnesses(manifest) }
}

function declaredHarnesses(manifest: unknown): string[] {
	const extensions = (manifest as { extensions?: Record<string, { harnesses?: unknown }> } | null)?.extensions
	const harnesses = extensions?.['org.cyberuni.universal-plugin']?.harnesses
	return typeof harnesses === 'object' && harnesses !== null && !Array.isArray(harnesses) ? Object.keys(harnesses) : []
}
