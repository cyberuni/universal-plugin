import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
	type DependencyDeclaration,
	translateDependencies,
	validateDependencies,
} from '../dependencies/dependencies.js'
import { type CanonicalHooksFile, type HookDrop, type HookTranslation, translateHooks } from '../hooks/hooks.js'
import { detectIndent } from '../json.js'
import { gatherCatalogRepo } from '../marketplace/fs.js'
import {
	refreshCatalogEntry,
	sameCatalogContent,
	TARGET_CATALOG_PATHS,
	VENDOR_TARGETS,
} from '../marketplace/marketplace.js'
import { formatCatalogIssues, validateCatalogContent } from '../marketplace/validation.js'
import { type McpPinNote, pinMcpServers } from '../pin/pin.js'

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

/** Vendors the canonical root manifest serves as-is. The build derives no *manifest* for these —
 *  writing one would either be shadowed by root (a lower-precedence path) or clobber root itself.
 *  Their components are a separate question: see COPILOT_NAMESPACE. */
const CANONICAL_SERVED = new Set<VendorId>(['copilot-cli'])

/** The reverse-domain directory Copilot CLI reads its native components from once a plugin declares
 *  the canonical `$schema` (ADR-0015). It REPLACES the plugin root for these kinds — a spec-mode
 *  runtime does not read `agents/` at all — so the build derives the tree rather than relying on the
 *  authored paths. `skills/` and `mcp.json` do not move.
 *  Evidence: `.research/copilot-spec-mode-namespace/`. */
const COPILOT_NAMESPACE = 'com.github.copilot'

/** Component kinds whose directories the namespace took over, copied file-for-file, each with the
 *  schema's default location for the field. The default is what an *undeclared* field means, never a
 *  stand-in for a declared path that did not resolve — the same asymmetry `readSkills` follows. */
const COPILOT_COPIED_KINDS: Record<string, string> = {
	agents: './agents/',
	commands: './commands/',
	rules: './rules/',
}

/** Where the namespace reads hooks and LSP config from. Fixed paths — Copilot CLI has no derived
 *  manifest that could repoint them. */
const COPILOT_HOOKS_PATH = 'hooks/hooks.json'
const COPILOT_LSP_PATH = 'lsp.json'

/** Authored under the namespace, never derived: Copilot's canvas extensions have no canonical root
 *  location to derive from, so `--clean` must leave this subtree alone. */
const COPILOT_AUTHORED_DIR = 'extensions'

/** What each vendor's build output occupies in the published package, for `plugin init --npm`'s
 *  `package.json` `files` wiring. */
export const VENDOR_SHIPPED_PATHS: Record<VendorId, string[]> = {
	'claude-code': [VENDOR_OUTPUT['claude-code']],
	cursor: [VENDOR_OUTPUT.cursor],
	codex: [VENDOR_OUTPUT.codex],
	// Not VENDOR_OUTPUT's `plugin.json`: that is the canonical manifest, which `--npm` already ships
	// as part of the open-standard base. What is Copilot-specific and derived is the component tree
	// (ADR-0015), so that is what has to travel.
	'copilot-cli': [`${COPILOT_NAMESPACE}/`],
}

/** Where every vendor looks for a plugin's hooks when the manifest declares none
 *  (`.research/hook-event-survey/conclusion.md`). */
const DEFAULT_HOOKS_PATH = './hooks/hooks.json'

/** Where skills live when the extension namespace declares no `skills` path. */
const DEFAULT_SKILLS_PATH = './skills/'

/** The Agent Plugins Specification's fixed location for a plugin's MCP config (ADR-0007 §6.1). */
const DEFAULT_MCP_PATH = './mcp.json'

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

/** Copilot CLI searches `.plugin/plugin.json` first, so a leftover one there outranks the canonical
 *  root manifest — the pre-0.6 layout's other half. */
const SHADOWING_MANIFEST = '.plugin/plugin.json'

/** The pre-0.6 layout signals, if any, that explain a build deriving nothing (issue #61). Pure: the
 *  one filesystem fact it needs is passed in.
 *
 *  Scoped to the two signals that are unambiguously the old layout. A manifest that merely omits the
 *  `extensions` block is not one of them — that is as likely a manifest nobody has configured yet as
 *  one left behind by an upgrade, and erroring on it would fail builds this change has no quarrel
 *  with. `doctor` still reports it as `legacy-manifest`, which is why the empty-state path points
 *  there. */
export function legacyLayoutSignals(manifest: PluginManifest, hasShadowingManifest: boolean): string[] {
	const signals: string[] = []
	if ('vendorExtensions' in manifest) {
		signals.push(
			'plugin.json carries a top-level "vendorExtensions" block — harness fields moved under extensions["org.cyberuni.universal-plugin"].harnesses',
		)
	}
	if (hasShadowingManifest) {
		signals.push(`${SHADOWING_MANIFEST} shadows the canonical root plugin.json`)
	}
	return signals
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

export interface CatalogRow {
	/** Repository-relative path of the catalog. */
	path: string
	status: 'updated' | 'unchanged' | 'planned'
}

export interface BuildResult {
	vendors: VendorId[]
	written: string[]
	warnings: string[]
	rows: VendorRow[]
	/** Repository-local marketplace catalogs whose entry for this plugin was re-derived. */
	catalogs: CatalogRow[]
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
		// Deriving nothing has two very different causes, and reporting both the same way is what let a
		// repository left on the pre-0.6 layout read `built 0` as success (issue #61). A canonical
		// manifest that genuinely declares no harnesses is an empty *result* (AXI #5) — exit 0, say so
		// plainly. A pre-0.6 layout still declares harnesses, somewhere this CLI no longer looks, so its
		// zero is a dropped read (AXI #6) — an error.
		const signals = legacyLayoutSignals(manifest, fs.existsSync(path.join(root, SHADOWING_MANIFEST)))
		if (signals.length > 0) {
			throw new Error(
				`Nothing was derived, and this project is still on the pre-0.6 manifest layout:\n${signals
					.map((s) => `  - ${s}`)
					.join('\n')}\nRun /universal-plugin:doctor for the full diagnosis and the skill that owns each repair.`,
			)
		}
		warnings.push('No vendors declared in harnesses — nothing to build')
		return { vendors: [], written: [], warnings, rows, catalogs: [], summary: summarize(rows) }
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
	const skills = readSkills(root, manifest, warnings)
	const canonicalHooks = readCanonicalHooks(root, componentConfig['hooks'], warnings)
	// An MCP invocation's version is known here and nowhere else: `mcp.json` expands only
	// ${PLUGIN_ROOT} and ${PLUGIN_DATA}, so a runtime placeholder would reach the client literally.
	const declaredMcp = readCanonicalMcpServers(root, componentConfig['mcpServers'], warnings)
	const mcp = declaredMcp ? pinMcpServers(declaredMcp.servers, manifest.version) : null
	// One marked entry is one loss to fix however many vendors are targeted.
	warnings.push(...(mcp?.notes ?? []).map(formatMcpNote))

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
			// The manifest is canonical, but the components are not: spec mode reads them from
			// `com.github.copilot/`, so this vendor does get a derived hooks file and a dropped handler
			// is dropped from it like any other vendor's (ADR-0015 revises ADR-0011 §3).
			for (const drop of dedupeDrops(hooks?.drops ?? [])) {
				warnings.push(
					`${vendor} cannot run the "${drop.type}" hook handler on ${drop.event} — dropped from the derived hooks file`,
				)
			}
			// `mcp.json` is one of the two paths spec mode leaves at the plugin root, so there is still
			// no derived file the pin could ride in.
			if (mcp?.changed) {
				warnings.push(
					`${vendor} reads the canonical plugin.json directly — the pinned mcpServers is not delivered to it`,
				)
			}
			const overrides = Object.keys(vendorFields)
			if (overrides.length > 0) {
				warnings.push(
					`harnesses.${vendor} sets ${overrides.join(', ')}, but ${vendor} reads the canonical plugin.json directly — these fields are not delivered`,
				)
			}
			writeSkillArtifacts(vendor, skills, opts, written, warnings)
			const derived = deriveCopilotNamespace(root, componentConfig, hooks, indent, opts, written, warnings)
			// Nothing to derive is still the old result, and still correct for the plugin that has no
			// component of a moved kind: root plugin.json serves it whole.
			rows.push(
				derived
					? { vendor, path: `${COPILOT_NAMESPACE}/`, status: 'built' }
					: { vendor, path: relPath, status: 'canonical' },
			)
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

		// Same rule hooks follows: a vendor whose form matches the canonical declaration keeps
		// pointing at it, and only a vendor that needs a different one gets a file beside its
		// manifest. With nothing marked, the derived form is the authored form — nothing to deliver.
		const derivedMcpPath = path.join(outputDir, 'mcp.json')
		if (mcp?.changed && declaredMcp) {
			if (declaredMcp.inline) {
				vendorManifest['mcpServers'] = mcp.servers
			} else {
				vendorManifest['mcpServers'] = `./${path.dirname(relPath).split(path.sep).join('/')}/mcp.json`
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
			if (mcp?.changed && declaredMcp && !declaredMcp.inline) {
				writeArtifact(derivedMcpPath, `${JSON.stringify({ mcpServers: mcp.servers }, null, indent)}\n`, opts, written)
			}
			writeSkillArtifacts(vendor, skills, opts, written, warnings)
			rows.push({ vendor, path: relPath, status: 'built' })
		} catch (err) {
			warnings.push(`Failed to write "${vendor}" → ${relPath}: ${err instanceof Error ? err.message : String(err)}`)
			rows.push({ vendor, path: relPath, status: 'failed' })
		}
	}

	const catalogs = refreshCatalogs(root, manifest, vendors, opts, written, warnings)

	return { vendors, written, warnings, rows, catalogs, summary: summarize(rows) }
}

/** Keeps the repository's marketplace catalogs true to the manifest just built. A catalog entry's
 *  version is copied from the canonical manifest and never authored (ADR-0010 §3), so the build that
 *  moves the manifest is what re-derives it — otherwise the entry keeps whatever version it was
 *  written with while the plugin moves on.
 *
 *  Only a catalog the repository already carries is touched, and only this plugin's entry inside it.
 *  Creating one is a choice `plugin init --vendor` and `marketplace init` own; a build makes no new
 *  files at the repository root. */
function refreshCatalogs(
	root: string,
	manifest: PluginManifest,
	vendors: VendorId[],
	opts: BuildOptions,
	written: string[],
	warnings: string[],
): CatalogRow[] {
	const repo = gatherCatalogRepo(root)
	if (!repo) return []

	const source = repo.pluginPath === '' ? './' : `./${repo.pluginPath}`
	const plugin = { name: manifest.name, source, metadata: manifest as Record<string, unknown> }
	const rows: CatalogRow[] = []
	const seen = new Set<string>()

	for (const vendor of vendors) {
		const target = VENDOR_TARGETS[vendor]
		if (!target) continue
		const relative = TARGET_CATALOG_PATHS[target]
		if (seen.has(relative)) continue
		seen.add(relative)
		const existing = repo.catalogs[relative]
		if (existing === undefined) continue

		try {
			const artifact = refreshCatalogEntry(target, plugin, existing)
			// The build refreshes one entry inside a file it did not author, so an invalid catalog is
			// reported rather than repaired or refused — `marketplace validate` is where that is fixed.
			const issues = validateCatalogContent(target, artifact.content)
			if (issues.length > 0) warnings.push(formatCatalogIssues(relative, issues))
			if (sameCatalogContent(artifact.content, existing)) {
				rows.push({ path: relative, status: 'unchanged' })
				continue
			}
			if (opts.dryRun) {
				rows.push({ path: relative, status: 'planned' })
				continue
			}
			const file = path.join(repo.root, relative)
			// The catalog keeps the indentation it was written with, so a refresh does not fight the
			// repository's own formatter.
			const content = `${JSON.stringify(JSON.parse(artifact.content), null, detectIndent(existing))}\n`
			fs.writeFileSync(file, content)
			written.push(file)
			rows.push({ path: relative, status: 'updated' })
		} catch (err) {
			warnings.push(`Failed to refresh "${relative}": ${err instanceof Error ? err.message : String(err)}`)
		}
	}
	return rows
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

/** Resolves a `pathValue` declaration — a single "./" path, an array of them, or a { paths: [...] }
 *  object — into the list of declared paths. Returns null when the field is absent or malformed, so
 *  the caller can tell "declared nothing" from "declared these", and never silently substitute a
 *  default for a form it failed to read. */
function resolvePathValue(declaration: unknown): string[] | null {
	if (typeof declaration === 'string') return [declaration]
	if (Array.isArray(declaration)) {
		const paths = declaration.filter((entry): entry is string => typeof entry === 'string')
		return paths.length === declaration.length ? paths : null
	}
	if (declaration && typeof declaration === 'object') {
		const paths = (declaration as { paths?: unknown }).paths
		if (Array.isArray(paths) && paths.every((entry) => typeof entry === 'string')) return paths as string[]
	}
	return null
}

function readSkills(root: string, manifest: PluginManifest, warnings: string[]): Skill[] {
	const skillsCfg = universalPluginExtension(manifest).skills
	const declared = skillsCfg === undefined ? null : resolvePathValue(skillsCfg)
	if (skillsCfg !== undefined && declared === null) {
		warnings.push('skills declaration is not a path, a path list, or a { paths } object — no skills were read')
		return []
	}

	// The default is what an undeclared field means, never a stand-in for a declared path that did
	// not resolve: a declared directory that is missing is warned about rather than papered over.
	const paths = declared ?? [DEFAULT_SKILLS_PATH]
	const skills: Skill[] = []
	for (const relPath of paths) {
		const skillsDir = path.resolve(root, relPath)
		if (!fs.existsSync(skillsDir)) {
			if (declared) warnings.push(`skills path "${relPath}" not found — no skills read from it`)
			continue
		}
		skills.push(...listSkillFiles(skillsDir).map((skillPath) => parseSkill(skillPath)))
	}
	return skills
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

/** Derives the `com.github.copilot/` tree Copilot CLI reads its native components from in spec mode
 *  (ADR-0015). Returns whether anything was derived — a plugin that declares none of the moved kinds
 *  has nothing here and keeps its `canonical` row.
 *
 *  The moved directory kinds are copied file-for-file: their content is vendor-neutral, and the
 *  namespace is a location change, not a format change. Hooks are the exception — they are translated
 *  first, exactly as for every other vendor. `skills/` and `mcp.json` stay at the plugin root and are
 *  deliberately not copied: a second copy under the namespace is one nothing reads. */
function deriveCopilotNamespace(
	root: string,
	componentConfig: Record<string, unknown>,
	hooks: HookTranslation | null,
	indent: string | number,
	opts: BuildOptions,
	written: string[],
	warnings: string[],
): boolean {
	const nsDir = path.join(root, COPILOT_NAMESPACE)
	if (opts.clean && !opts.dryRun) cleanCopilotNamespace(nsDir)

	let derived = false

	for (const [kind, defaultPath] of Object.entries(COPILOT_COPIED_KINDS)) {
		const declaration = componentConfig[kind]
		const declared = declaration === undefined ? null : resolvePathValue(declaration)
		if (declaration !== undefined && declared === null) {
			warnings.push(
				`${kind} declaration is not a path, a path list, or a { paths } object — nothing copied to ${COPILOT_NAMESPACE}/${kind}/`,
			)
			continue
		}
		for (const relPath of declared ?? [defaultPath]) {
			const sourceDir = path.resolve(root, relPath)
			if (!fs.existsSync(sourceDir)) {
				// An undeclared default that is simply absent is the ordinary case, not a loss.
				if (declared)
					warnings.push(`${kind} path "${relPath}" not found — nothing copied to ${COPILOT_NAMESPACE}/${kind}/`)
				continue
			}
			for (const file of listFilesRecursive(sourceDir)) {
				const relative = path.relative(sourceDir, file)
				const target = kind === 'agents' ? copilotAgentName(relative) : relative
				writeArtifact(path.join(nsDir, kind, target), fs.readFileSync(file), opts, written)
				derived = true
			}
		}
	}

	// Copilot CLI has no derived manifest, so its hooks file cannot be repointed — it lives at the
	// one path spec mode reads.
	const hooksPath = path.join(nsDir, COPILOT_HOOKS_PATH)
	if (hooks?.hooks) {
		writeArtifact(hooksPath, `${JSON.stringify(hooks.hooks, null, indent)}\n`, opts, written)
		derived = true
	} else if (hooks && !opts.dryRun && fs.existsSync(hooksPath)) {
		// Nothing runnable survived this time; an earlier build's file would linger unreferenced.
		fs.unlinkSync(hooksPath)
	}

	// A declared path is copied verbatim. An inline map would mean composing the file, and its
	// top-level shape is not documented anywhere — so it warns rather than guessing (ADR-0015 §3).
	const lspDeclaration = componentConfig['lspServers']
	if (lspDeclaration !== undefined) {
		const lspPaths = resolvePathValue(lspDeclaration)
		if (lspPaths === null) {
			warnings.push(
				'copilot-cli reads lspServers from com.github.copilot/lsp.json, and an inline map has no documented file shape to write — not delivered',
			)
		} else {
			for (const relPath of lspPaths) {
				const sourceFile = path.resolve(root, relPath)
				if (!fs.existsSync(sourceFile)) {
					warnings.push(
						`lspServers path "${relPath}" not found — nothing copied to ${COPILOT_NAMESPACE}/${COPILOT_LSP_PATH}`,
					)
					continue
				}
				writeArtifact(path.join(nsDir, COPILOT_LSP_PATH), fs.readFileSync(sourceFile), opts, written)
				derived = true
			}
		}
	}

	return derived
}

/** Copilot CLI reads `agents/` as `.agent.md` files, while the canonical `agents/` is the Claude
 *  Code-shaped `*.md`. Copying the authored name would land a file the runtime ignores — the same
 *  silent loss ADR-0015 exists to end, one directory over. Commands and rules are copied verbatim:
 *  the runtime documents no extension for either, and inventing one would be a guess. */
function copilotAgentName(relative: string): string {
	if (!relative.endsWith('.md') || relative.endsWith('.agent.md')) return relative
	return `${relative.slice(0, -'.md'.length)}.agent.md`
}

/** Removes what the build derives under the namespace, and only that. `extensions/` is authored
 *  there — deleting it would destroy the one thing in the tree nothing can regenerate. */
function cleanCopilotNamespace(nsDir: string) {
	if (!fs.existsSync(nsDir)) return
	for (const entry of fs.readdirSync(nsDir, { withFileTypes: true })) {
		if (entry.name === COPILOT_AUTHORED_DIR) continue
		fs.rmSync(path.join(nsDir, entry.name), { recursive: true, force: true })
	}
}

function listFilesRecursive(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dir, entry.name)
		if (entry.isDirectory()) return listFilesRecursive(entryPath)
		return entry.isFile() ? [entryPath] : []
	})
}

function writeArtifact(outputPath: string, content: string | Buffer, opts: BuildOptions, written: string[]) {
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

/** The canonical `mcpServers` declaration, resolved into one servers map. `inline` records how the
 *  author wrote it, because that decides how a pinned map is delivered: an inline declaration stays
 *  inline in the derived manifest, a path declaration gets a derived file beside it. */
interface CanonicalMcp {
	servers: Record<string, unknown>
	inline: boolean
}

/** Resolves the canonical MCP declaration — an inline block, a path, or a list of paths — the same
 *  way hooks are resolved. Returns null when there is nothing to read; an unreadable declaration
 *  warns and leaves the declaration to pass through untouched. */
function readCanonicalMcpServers(root: string, declaration: unknown, warnings: string[]): CanonicalMcp | null {
	if (declaration && typeof declaration === 'object' && !Array.isArray(declaration)) {
		const block = declaration as Record<string, unknown>
		if (Array.isArray(block['paths'])) {
			return fromPaths(root, block['paths'] as string[], warnings)
		}
		const inner = block['mcpServers']
		const servers = inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : block
		return { servers: servers as Record<string, unknown>, inline: true }
	}

	const declared =
		typeof declaration === 'string' ? [declaration] : Array.isArray(declaration) ? (declaration as string[]) : null

	// An undeclared MCP config still ships from the spec's fixed location, which every vendor reads.
	const paths = declared ?? (fs.existsSync(path.resolve(root, DEFAULT_MCP_PATH)) ? [DEFAULT_MCP_PATH] : [])
	if (paths.length === 0) return null
	return fromPaths(root, paths, warnings)
}

function fromPaths(root: string, paths: string[], warnings: string[]): CanonicalMcp | null {
	const merged: Record<string, unknown> = {}
	let read = 0
	for (const relPath of paths) {
		const mcpPath = path.resolve(root, relPath)
		if (!fs.existsSync(mcpPath)) {
			warnings.push(`mcp file "${relPath}" not found — left untranslated`)
			continue
		}
		try {
			const parsed = JSON.parse(fs.readFileSync(mcpPath, 'utf8')) as Record<string, unknown>
			const inner = parsed['mcpServers']
			const servers = inner && typeof inner === 'object' && !Array.isArray(inner) ? inner : parsed
			Object.assign(merged, servers)
			read++
		} catch (err) {
			warnings.push(
				`mcp file "${relPath}" could not be read — left untranslated: ${err instanceof Error ? err.message : String(err)}`,
			)
		}
	}
	return read === 0 ? null : { servers: merged, inline: false }
}

/** A marked entry that could not be pinned is a silent loss of the guarantee the marker asked for,
 *  so each one is named. None of them fails the build — the manifest still derives. */
function formatMcpNote(note: McpPinNote): string {
	switch (note.kind) {
		case 'no-manifest-version':
			return `mcpServers "${note.server}" asks to be pinned to the plugin version, but the manifest declares no version — left unpinned`
		case 'not-a-runner':
			return `mcpServers "${note.server}" asks to be pinned to the plugin version, but its command is not "npx" or "upx" — left unpinned`
		case 'no-specifier':
			return `mcpServers "${note.server}" asks to be pinned to the plugin version, but its args carry no package specifier — left unpinned`
		case 'repinned':
			return `mcpServers "${note.server}" was authored at "${note.previous}" — overwritten with the plugin version`
	}
}
