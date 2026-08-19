import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
	type DependencyDeclaration,
	translateDependencies,
	validateDependencies,
} from '../dependencies/dependencies.js'
import { type CanonicalHooksFile, type HookDrop, translateHooks } from '../hooks/hooks.js'
import { detectIndent } from '../json.js'

type VendorId = 'claude-code' | 'cursor' | 'codex' | 'copilot-cli'

/** Where each vendor reads its manifest, relative to the project root. Shared with
 *  `plugin init --npm`, which wires exactly these paths into `package.json` `files`. */
export const VENDOR_OUTPUT: Record<VendorId, string> = {
	'claude-code': '.claude-plugin/plugin.json',
	cursor: '.cursor-plugin/plugin.json',
	codex: '.codex-plugin/plugin.json',
	// Copilot CLI searches four paths and takes the FIRST match:
	//   .plugin/plugin.json → plugin.json → .github/plugin/plugin.json → .claude-plugin/plugin.json
	// (docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
	// Root `plugin.json` — our canonical manifest (ADR-0007) — is #2, so it always shadows #3 and #4.
	// We previously derived to `.github/plugin/plugin.json` "to avoid colliding with" root, but that
	// path loses the collision by construction and was never read. Copilot CLI has consumed Open
	// Plugin Spec v1 manifests since v1.0.74, so the canonical manifest already serves it directly.
	'copilot-cli': 'plugin.json',
}

const KNOWN_VENDORS = new Set<string>(Object.keys(VENDOR_OUTPUT))

/** Vendors the canonical root manifest serves as-is. The build derives no file for these — writing
 *  one would either be shadowed by root (a lower-precedence path) or clobber root itself. */
const CANONICAL_SERVED = new Set<VendorId>(['copilot-cli'])

/** Where every vendor looks for a plugin's hooks when the manifest declares none
 *  (`.research/hook-event-survey/conclusion.md`). */
const DEFAULT_HOOKS_PATH = './hooks/hooks.json'

/** universal-plugin's own build config, nested under extensions["org.cyberuni.universal-plugin"]
 *  in the canonical Agent Plugins Spec v1.0.0 manifest (ADR-0007). */
export interface UniversalPluginExtension {
	vendors?: string[]
	packagePath?: string
	/** Per-harness manifest overrides, keyed by vendor id (was top-level `vendorExtensions`). */
	harnesses?: Record<string, Record<string, unknown>>
	/** Plugins this plugin needs. Canonical here because the runtimes that read one disagree on
	 *  whether they read one at all — the build delivers it per vendor (ADR-0013). */
	dependencies?: DependencyDeclaration[]
	skills?: unknown
	[key: string]: unknown
}

export interface PluginManifest {
	$schema?: string
	name: string
	version?: string
	description?: string
	extensions?: Record<string, Record<string, unknown>>
	[key: string]: unknown
}

const UP_NAMESPACE = 'org.cyberuni.universal-plugin'

/** Reads universal-plugin's config block from the canonical manifest's extensions map. */
export function universalPluginExtension(manifest: PluginManifest): UniversalPluginExtension {
	return (manifest.extensions?.[UP_NAMESPACE] as UniversalPluginExtension | undefined) ?? {}
}

export interface BuildOptions {
	vendor?: string
	dryRun?: boolean
	verbose?: boolean
	clean?: boolean
}

export interface VendorRow {
	vendor: string
	path: string
	status: 'built' | 'skipped' | 'failed' | 'canonical'
}

export interface BuildResult {
	vendors: VendorId[]
	written: string[]
	warnings: string[]
	rows: VendorRow[]
	summary: { built: number; skipped: number; failed: number; canonical: number }
}

type InvocationPolicy = 'user' | 'model' | 'both'

interface Skill {
	path: string
	name: string
	invocationPolicy: InvocationPolicy
	hasInvocationPolicy: boolean
	body: string
	content: string
}

export function readManifest(root: string): PluginManifest {
	const manifestPath = path.join(root, 'plugin.json')
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`No plugin.json found at ${root}`)
	}
	return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PluginManifest
}

/** Validates the manifest. Vendor rules apply only to the vendors actually being built: pass
 *  `targets` to scope the check (build passes its selected targets), else it defaults to the
 *  manifest's own selection (`vendors ?? harnesses` keys). */
export function validateManifest(manifest: PluginManifest, targets?: string[]): string[] {
	const errors: string[] = []
	if (!manifest.name) errors.push('name is required')
	const uext = universalPluginExtension(manifest)
	const harnesses = uext.harnesses ?? {}
	const checked = targets ?? uext.vendors ?? Object.keys(harnesses)
	const codexTargeted = checked.includes('codex') && Boolean(harnesses['codex'])
	if (codexTargeted && !manifest.description) {
		errors.push('description is required when targeting codex')
	}
	if (codexTargeted && !manifest.version) {
		errors.push('version is required when targeting codex')
	}
	// Dependency shape is a canonical rule, not a vendor one: a malformed declaration is rejected by
	// the runtime that reads it whichever vendors this build targets.
	errors.push(...validateDependencies(uext.dependencies).errors)
	return errors
}

export function buildPlugin(root: string, opts: BuildOptions = {}): BuildResult {
	const manifestPath = path.join(root, 'plugin.json')
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`No plugin.json found at ${root}`)
	}
	const manifestRaw = fs.readFileSync(manifestPath, 'utf8')
	const indent = detectIndent(manifestRaw)
	const manifest = readManifest(root)

	const warnings: string[] = []
	const rows: VendorRow[] = []
	const uext = universalPluginExtension(manifest)
	const harnesses = uext.harnesses ?? {}

	// Target selection (ADR-0007): the explicit `vendors` list when present, else every harnesses key.
	const targets = uext.vendors ?? Object.keys(harnesses)

	let vendors = targets.filter((v): v is VendorId => {
		if (!KNOWN_VENDORS.has(v)) {
			warnings.push(`Unknown vendor "${v}" in harnesses — skipped`)
			rows.push({ vendor: v, path: '-', status: 'skipped' })
			return false
		}
		return true
	})

	if (opts.vendor) {
		if (!vendors.includes(opts.vendor as VendorId)) {
			throw new Error(`Vendor "${opts.vendor}" not declared in harnesses`)
		}
		vendors = [opts.vendor as VendorId]
	}

	if (vendors.length === 0) {
		warnings.push('No vendors declared in harnesses — nothing to build')
		return { vendors: [], written: [], warnings, rows, summary: summarize(rows) }
	}

	// Eager validation, scoped to the vendors actually being built — a codex block that is not a
	// selected target must not block a build of the others.
	const errors = validateManifest(manifest, vendors)
	if (errors.length > 0) throw new Error(`plugin.json validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)

	const written: string[] = []
	// A derived <harness>/plugin.json carries the spec metadata plus the canonical component paths the
	// harness consumes, then that harness's own overrides. universal-plugin's build orchestration
	// (`vendors`, `packagePath`, `harnesses`) and the spec wrapper (`$schema`, `extensions`) are ours —
	// they never belong in a harness manifest.
	const { $schema: _schema, extensions: _extensions, ...metadata } = manifest
	const {
		vendors: _vendors,
		packagePath: _packagePath,
		harnesses: _harnesses,
		dependencies: declaredDependencies,
		...componentConfig
	} = uext
	// A declaration the runtime accepts and then discards is an invisible loss, and it is one loss to
	// fix however many vendors are targeted.
	warnings.push(...validateDependencies(declaredDependencies).warnings)
	const skills = readSkills(root, manifest)
	const canonicalHooks = readCanonicalHooks(root, componentConfig['hooks'], warnings)

	for (const vendor of vendors) {
		const relPath = VENDOR_OUTPUT[vendor]
		const outputPath = path.join(root, relPath)
		const outputDir = path.dirname(outputPath)
		const vendorFields = harnesses[vendor] ?? {}
		const vendorManifest: Record<string, unknown> = { ...metadata, ...componentConfig, ...vendorFields }
		const hooks = canonicalHooks ? translateHooks(canonicalHooks, vendor) : null
		const dependencies = translateDependencies(declaredDependencies ?? [], vendor)
		warnings.push(...dependencies.warnings)
		if (dependencies.dependencies) vendorManifest['dependencies'] = dependencies.dependencies

		// The canonical manifest already is this vendor's manifest — derive nothing and never write
		// over root. Any harness override for it has no delivery path: the canonical schema is closed
		// (`additionalProperties: false`), so a vendor-only field cannot ride along in root.
		if (CANONICAL_SERVED.has(vendor)) {
			// No derived manifest to repoint and no derived file to deliver — this vendor reads the
			// canonical hooks file itself, so naming the handler it will ignore is the whole remedy
			// (ADR-0011).
			for (const drop of dedupeDrops(hooks?.drops ?? [])) {
				warnings.push(
					`${vendor} cannot run the "${drop.type}" hook handler on ${drop.event} — it is ignored at runtime`,
				)
			}
			const overrides = Object.keys(vendorFields)
			if (overrides.length > 0) {
				warnings.push(
					`harnesses.${vendor} sets ${overrides.join(', ')}, but ${vendor} reads the canonical plugin.json directly — these fields are not delivered`,
				)
			}
			writeSkillArtifacts(vendor, skills, opts, written, warnings)
			rows.push({ vendor, path: relPath, status: 'canonical' })
			continue
		}

		for (const drop of dedupeDrops(hooks?.drops ?? [])) {
			warnings.push(
				`${vendor} cannot run the "${drop.type}" hook handler on ${drop.event} — dropped from the derived hooks file`,
			)
		}

		// A vendor whose hooks form matches the canonical file keeps pointing at it; only a vendor
		// that needs a different file gets one, beside its own manifest (ADR-0011).
		const derivedHooksPath = path.join(outputDir, 'hooks.json')
		if (hooks?.changed) {
			if (hooks.hooks) {
				vendorManifest['hooks'] = `./${path.dirname(relPath).split(path.sep).join('/')}/hooks.json`
			} else {
				delete vendorManifest['hooks']
			}
		}

		if (opts.verbose) {
			console.log(`[${vendor}] → ${outputPath}`)
			for (const key of Object.keys(vendorFields)) {
				console.log(`  + ${key} (from harnesses.${vendor})`)
			}
		}

		try {
			if (!opts.dryRun) {
				if (opts.clean && fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
				fs.mkdirSync(outputDir, { recursive: true })
				fs.writeFileSync(outputPath, `${JSON.stringify(vendorManifest, null, indent)}\n`)
			}
			written.push(outputPath)
			if (hooks?.changed) {
				if (hooks.hooks) {
					writeArtifact(derivedHooksPath, `${JSON.stringify(hooks.hooks, null, indent)}\n`, opts, written)
				} else if (!opts.dryRun && fs.existsSync(derivedHooksPath)) {
					// Nothing runnable is left this time; an earlier build's file would linger unreferenced.
					fs.unlinkSync(derivedHooksPath)
				}
			}
			writeSkillArtifacts(vendor, skills, opts, written, warnings)
			rows.push({ vendor, path: relPath, status: 'built' })
		} catch (err) {
			warnings.push(`Failed to write "${vendor}" → ${relPath}: ${err instanceof Error ? err.message : String(err)}`)
			rows.push({ vendor, path: relPath, status: 'failed' })
		}
	}

	return { vendors, written, warnings, rows, summary: summarize(rows) }
}

function writeSkillArtifacts(
	vendor: VendorId,
	skills: Skill[],
	opts: BuildOptions,
	written: string[],
	warnings: string[],
) {
	for (const skill of skills) {
		if (vendor === 'claude-code') {
			writeClaudeSkill(skill, opts, written)
			continue
		}

		// Cursor reads SKILL.md straight from the manifest's `skills` path and lets the user invoke a
		// skill by typing `/` and searching for it (cursor.com/docs/skills), so a mirrored
		// .cursor/commands/*.md is a redundant second copy of the same body. Cursor also expresses
		// explicit-only invocation natively via `disable-model-invocation`, which writeClaudeSkill
		// already writes into the shared SKILL.md — nothing to derive here.
		if (vendor === 'cursor') continue

		if (skill.invocationPolicy === 'model') continue

		if (vendor === 'codex') {
			try {
				writeArtifact(path.join(os.homedir(), '.codex', 'prompts', `${skill.name}.md`), skill.body, opts, written)
			} catch (err) {
				warnings.push(
					`Failed to write Codex prompt for skill "${skill.name}" (best-effort): ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}
	}
}

function readSkills(root: string, manifest: PluginManifest): Skill[] {
	const skillsCfg = universalPluginExtension(manifest).skills
	const skillsPath = typeof skillsCfg === 'string' ? skillsCfg : './skills/'
	const skillsDir = path.resolve(root, skillsPath)
	if (!fs.existsSync(skillsDir)) return []

	return listSkillFiles(skillsDir).map((skillPath) => parseSkill(skillPath))
}

function listSkillFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dir, entry.name)
		if (entry.isDirectory()) return listSkillFiles(entryPath)
		return entry.isFile() && entry.name === 'SKILL.md' ? [entryPath] : []
	})
}

function parseSkill(skillPath: string): Skill {
	const content = fs.readFileSync(skillPath, 'utf8')
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
	const frontmatter = match?.[1] ?? ''
	const rawPolicy = frontmatter.match(/^invocation-policy:\s*['"]?(user|model|both)['"]?\s*(?:#.*)?$/m)?.[1]
	const declaredPolicy = frontmatter.match(/^invocation-policy:\s*(\S+)/m)?.[1]
	if (declaredPolicy && !rawPolicy) {
		throw new Error(`Invalid invocation-policy "${declaredPolicy}" in ${skillPath}; expected user, model, or both`)
	}

	return {
		path: skillPath,
		name: path.basename(path.dirname(skillPath)),
		invocationPolicy: (rawPolicy as InvocationPolicy | undefined) ?? 'both',
		hasInvocationPolicy: rawPolicy !== undefined,
		body: match ? content.slice(match[0].length) : content,
		content,
	}
}

function writeClaudeSkill(skill: Skill, opts: BuildOptions, written: string[]) {
	if (!skill.hasInvocationPolicy) return
	const content = withClaudeInvocationFlags(skill)
	if (content === skill.content) return
	if (!opts.dryRun) fs.writeFileSync(skill.path, content)
	written.push(skill.path)
}

function withClaudeInvocationFlags(skill: Skill): string {
	const match = skill.content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!match) return skill.content

	const lines = match[1].split(/\r?\n/).filter((line) => !/^(disable-model-invocation|user-invocable):\s*/.test(line))
	if (skill.invocationPolicy === 'user') lines.push('disable-model-invocation: true')
	if (skill.invocationPolicy === 'model') lines.push('user-invocable: false')
	return `${skill.content.slice(0, match.index)}---\n${lines.join('\n')}\n---${skill.content.slice(match.index! + match[0].length)}`
}

function writeArtifact(outputPath: string, content: string, opts: BuildOptions, written: string[]) {
	if (!opts.dryRun) {
		if (opts.clean && fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
		fs.mkdirSync(path.dirname(outputPath), { recursive: true })
		fs.writeFileSync(outputPath, content)
	}
	written.push(outputPath)
}

function summarize(rows: VendorRow[]): BuildResult['summary'] {
	return {
		built: rows.filter((r) => r.status === 'built').length,
		skipped: rows.filter((r) => r.status === 'skipped').length,
		failed: rows.filter((r) => r.status === 'failed').length,
		canonical: rows.filter((r) => r.status === 'canonical').length,
	}
}

/** Resolves the canonical hooks declaration — a path, a list of paths, or an inline block — into one
 *  hooks document. Returns null when there is nothing to translate; an unreadable declaration warns
 *  and leaves the declaration to pass through untouched. */
function readCanonicalHooks(root: string, declaration: unknown, warnings: string[]): CanonicalHooksFile | null {
	if (declaration && typeof declaration === 'object' && 'hooks' in declaration) {
		return declaration as CanonicalHooksFile
	}

	const declared =
		typeof declaration === 'string'
			? [declaration]
			: declaration && typeof declaration === 'object' && Array.isArray((declaration as { paths?: unknown }).paths)
				? ((declaration as { paths: string[] }).paths ?? [])
				: null

	// Undeclared hooks still ship from the default location, which every vendor auto-discovers.
	const paths = declared ?? (fs.existsSync(path.resolve(root, DEFAULT_HOOKS_PATH)) ? [DEFAULT_HOOKS_PATH] : [])
	if (paths.length === 0) return null

	const merged: CanonicalHooksFile = { hooks: {} }
	let read = 0
	for (const relPath of paths) {
		const hooksPath = path.resolve(root, relPath)
		if (!fs.existsSync(hooksPath)) {
			warnings.push(`hooks file "${relPath}" not found — left untranslated`)
			continue
		}
		let parsed: CanonicalHooksFile
		try {
			parsed = JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as CanonicalHooksFile
		} catch (err) {
			warnings.push(
				`hooks file "${relPath}" could not be read — left untranslated: ${err instanceof Error ? err.message : String(err)}`,
			)
			continue
		}
		read++
		for (const [event, rules] of Object.entries(parsed.hooks ?? {})) {
			merged.hooks[event] = [...(merged.hooks[event] ?? []), ...rules]
		}
	}

	return read === 0 ? null : merged
}

/** One warning per event and handler type — three dropped prompt handlers on one event are one loss
 *  to fix, not three. */
function dedupeDrops(drops: HookDrop[]): HookDrop[] {
	const seen = new Set<string>()
	return drops.filter((drop) => {
		const key = `${drop.event}\u0000${drop.type}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}
