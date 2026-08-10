import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { detectIndent } from '../json.js'

type VendorId = 'claude-code' | 'cursor' | 'codex' | 'copilot-cli'

const VENDOR_OUTPUT: Record<VendorId, string> = {
	'claude-code': '.claude-plugin/plugin.json',
	cursor: '.cursor-plugin/plugin.json',
	codex: '.codex-plugin/plugin.json',
	'copilot-cli': 'plugin.json',
}

const KNOWN_VENDORS = new Set<string>(Object.keys(VENDOR_OUTPUT))

export interface PluginManifest {
	$schema?: string
	name: string
	version?: string
	description?: string
	vendorExtensions?: Record<string, Record<string, unknown>>
	[key: string]: unknown
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
	status: 'built' | 'skipped' | 'failed'
}

export interface BuildResult {
	vendors: VendorId[]
	written: string[]
	warnings: string[]
	rows: VendorRow[]
	summary: { built: number; skipped: number; failed: number }
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
	const manifestPath = path.join(root, '.plugin', 'plugin.json')
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`No .plugin/plugin.json found at ${root}`)
	}
	return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PluginManifest
}

export function validateManifest(manifest: PluginManifest): string[] {
	const errors: string[] = []
	if (!manifest.name) errors.push('name is required')
	if (manifest.vendorExtensions?.codex && !manifest.description) {
		errors.push('description is required when targeting codex')
	}
	if (manifest.vendorExtensions?.codex && !manifest.version) {
		errors.push('version is required when targeting codex')
	}
	return errors
}

export function buildPlugin(root: string, opts: BuildOptions = {}): BuildResult {
	const manifestPath = path.join(root, '.plugin', 'plugin.json')
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`No .plugin/plugin.json found at ${root}`)
	}
	const manifestRaw = fs.readFileSync(manifestPath, 'utf8')
	const indent = detectIndent(manifestRaw)
	const manifest = readManifest(root)
	const errors = validateManifest(manifest)
	if (errors.length > 0) throw new Error(`plugin.json validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)

	const warnings: string[] = []
	const rows: VendorRow[] = []
	const vendorExtensions = manifest.vendorExtensions ?? {}

	let vendors = Object.keys(vendorExtensions).filter((v): v is VendorId => {
		if (!KNOWN_VENDORS.has(v)) {
			warnings.push(`Unknown vendor "${v}" in vendorExtensions — skipped`)
			rows.push({ vendor: v, path: '-', status: 'skipped' })
			return false
		}
		return true
	})

	if (opts.vendor) {
		if (!vendors.includes(opts.vendor as VendorId)) {
			throw new Error(`Vendor "${opts.vendor}" not declared in vendorExtensions`)
		}
		vendors = [opts.vendor as VendorId]
	}

	if (vendors.length === 0) {
		warnings.push('No vendors declared in vendorExtensions — nothing to build')
		return { vendors: [], written: [], warnings, rows, summary: summarize(rows) }
	}

	const written: string[] = []
	const { vendorExtensions: _ext, $schema: _schema, ...canonical } = manifest
	const skills = readSkills(root, manifest)

	for (const vendor of vendors) {
		const relPath = VENDOR_OUTPUT[vendor]
		const outputPath = path.join(root, relPath)
		const outputDir = path.dirname(outputPath)
		const vendorFields = vendorExtensions[vendor] ?? {}
		const vendorManifest = { ...canonical, ...vendorFields }

		if (opts.verbose) {
			console.log(`[${vendor}] → ${outputPath}`)
			for (const key of Object.keys(vendorFields)) {
				console.log(`  + ${key} (from vendorExtensions)`)
			}
		}

		try {
			if (!opts.dryRun) {
				if (opts.clean && fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
				fs.mkdirSync(outputDir, { recursive: true })
				fs.writeFileSync(outputPath, `${JSON.stringify(vendorManifest, null, indent)}\n`)
			}
			written.push(outputPath)
			writeSkillArtifacts(root, vendor, skills, opts, written, warnings)
			rows.push({ vendor, path: relPath, status: 'built' })
		} catch (err) {
			warnings.push(`Failed to write "${vendor}" → ${relPath}: ${err instanceof Error ? err.message : String(err)}`)
			rows.push({ vendor, path: relPath, status: 'failed' })
		}
	}

	return { vendors, written, warnings, rows, summary: summarize(rows) }
}

function writeSkillArtifacts(
	root: string,
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

		if (skill.invocationPolicy === 'model') continue

		if (vendor === 'cursor') {
			writeArtifact(path.join(root, '.cursor', 'commands', `${skill.name}.md`), skill.body, opts, written)
			continue
		}

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
	const skillsPath = typeof manifest.skills === 'string' ? manifest.skills : './skills/'
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
	}
}
