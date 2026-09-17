import * as path from 'node:path'
import {
	referencedGovernances,
	rewriteGovernancePointers,
	SKILL_GOVERNANCE_DIR,
	unlistedGovernanceCopies,
} from './copy.js'
import type { GovernanceCopyFs } from './fs.js'

/** Where a package keeps the governances it owns. A governance ships in its owner's package as a
 *  plain Markdown file — the copy step needs nothing else from the owner. */
const OWNER_DIR = 'governances'

export interface GovernanceCopyEntry {
	/** The skill folder's name, as the build names a skill. */
	skill: string
	name: string
	/** Absolute path of the copy inside the skill. */
	path: string
	/** The package the copy came from; `.` when the plugin being built owns the governance. */
	owner: string
	/** `written` — the copy was refreshed; `unchanged` — it already matched; `stale` — it differs
	 *  from its source and nothing was written, which `--check` and `--dry-run` produce. */
	status: 'written' | 'unchanged' | 'stale'
}

export interface GovernanceCopyResult {
	entries: GovernanceCopyEntry[]
	/** Conditions that fail the build: a declaration that names no governance, an owner the copy
	 *  cannot reach, or a SKILL.md that does not list a copy. */
	errors: string[]
}

export interface GovernanceCopyOptions {
	/** Resolve sources and compare, but write nothing. Drift is reported as a `stale` entry. */
	check?: boolean
	/** Report what would be written without writing it. Drift is not an error. */
	dryRun?: boolean
}

/** A skill as the copy step needs it: where its SKILL.md is, and what it is called. */
export interface GovernanceSkill {
	path: string
	name: string
}

/** Refreshes every skill's governance copies from their owning packages.
 *
 *  The files already in `<skill>/references/governances/` declare which governances the skill uses.
 *  Each is rewritten from its owner's current copy, every governance a copy references is copied
 *  too, and the retrieval pointers inside each copy are rewritten to name the sibling file. */
export function syncGovernanceCopies(
	root: string,
	skills: GovernanceSkill[],
	govFs: GovernanceCopyFs,
	opts: GovernanceCopyOptions = {},
): GovernanceCopyResult {
	const entries: GovernanceCopyEntry[] = []
	const errors: string[] = []
	const owners = ownerDirs(root, govFs)

	for (const skill of skills) {
		const skillDir = path.dirname(skill.path)
		const copyDir = path.join(skillDir, ...SKILL_GOVERNANCE_DIR.split('/'))
		// No folder means the skill declares no governance. An empty folder means the same thing.
		if (!govFs.isDirectory(copyDir)) continue

		const copied: string[] = []
		// The declaration is the starting set; a copy's own references extend it as they are read,
		// so the queue grows while it drains and every transitive document lands in the same folder.
		const declared = govFs.list(copyDir)
		const queue: Wanted[] = declared.map((name) => ({ name }))
		const seen = new Set(declared)
		while (queue.length > 0) {
			const wanted = queue.shift() as Wanted
			const { name } = wanted
			const source = resolveSource(name, owners, govFs)
			if (!source) {
				errors.push(unresolvedMessage(skill.name, wanted, owners))
				continue
			}
			copied.push(name)
			for (const referenced of referencedGovernances(source.content)) {
				if (seen.has(referenced)) continue
				seen.add(referenced)
				queue.push({ name: referenced, via: name })
			}

			const content = rewriteGovernancePointers(source.content)
			const target = path.join(copyDir, `${name}.md`)
			const current = govFs.exists(target) ? govFs.read(target) : null
			if (current === content) {
				entries.push({ skill: skill.name, name, path: target, owner: source.owner, status: 'unchanged' })
				continue
			}
			if (opts.check || opts.dryRun) {
				entries.push({ skill: skill.name, name, path: target, owner: source.owner, status: 'stale' })
				continue
			}
			govFs.write(target, content)
			entries.push({ skill: skill.name, name, path: target, owner: source.owner, status: 'written' })
		}

		// The specification asks SKILL.md to reference every file the agent needs directly. A copy no
		// References section names is a file with no documented way in, so it fails the build here
		// rather than at the moment an agent goes looking for it.
		const skillMd = govFs.read(skill.path)
		const unlisted = unlistedGovernanceCopies(skillMd, copied)
		for (const name of unlisted) {
			errors.push(
				`skill "${skill.name}": SKILL.md does not list \`${SKILL_GOVERNANCE_DIR}/${name}.md\` under References.`,
			)
		}
	}

	return { entries, errors }
}

/** A governance the copy step still owes the skill, and why: a file in the declaration folder, or a
 *  pointer inside the governance named by `via`. The two fail differently and read differently. */
interface Wanted {
	name: string
	via?: string
}

function unresolvedMessage(skill: string, wanted: Wanted, owners: Owner[]): string {
	const checked = `No installed package owns it — checked ${owners.map((o) => o.name).join(', ')}.`
	return wanted.via
		? `skill "${skill}": governance "${wanted.via}" references "${wanted.name}", which has no copy to point at. ${checked}`
		: `skill "${skill}": ${SKILL_GOVERNANCE_DIR}/${wanted.name}.md names no governance. ${checked}`
}

interface Owner {
	name: string
	dir: string
}

interface Source {
	owner: string
	content: string
}

function resolveSource(name: string, owners: Owner[], govFs: GovernanceCopyFs): Source | null {
	for (const owner of owners) {
		const filePath = path.join(owner.dir, `${name}.md`)
		if (govFs.exists(filePath)) return { owner: owner.name, content: govFs.read(filePath) }
	}
	return null
}

/** The packages a governance may come from, in resolution order: the plugin being built, then its
 *  declared dependencies. The plugin wins — a plugin that ships a governance owns that name, and a
 *  build must not copy a stale published copy of a document its own tree holds. */
function ownerDirs(root: string, govFs: GovernanceCopyFs): Owner[] {
	const owners: Owner[] = [{ name: '.', dir: path.join(root, OWNER_DIR) }]
	for (const pkg of declaredDependencies(root, govFs)) {
		const dir = packageDir(root, pkg, govFs)
		if (dir) owners.push({ name: pkg, dir: path.join(dir, OWNER_DIR) })
	}
	return owners
}

/** Every package the plugin's own `package.json` declares. A governance owner is installed as a dev
 *  dependency of the repository being built; runtime dependencies are read too, because which of
 *  the two a plugin author picked is not this step's business. */
function declaredDependencies(root: string, govFs: GovernanceCopyFs): string[] {
	const manifestPath = path.join(root, 'package.json')
	if (!govFs.exists(manifestPath)) return []
	let parsed: { dependencies?: unknown; devDependencies?: unknown }
	try {
		parsed = JSON.parse(govFs.read(manifestPath))
	} catch {
		return []
	}
	const names = new Set<string>()
	for (const field of [parsed.devDependencies, parsed.dependencies]) {
		if (field && typeof field === 'object') for (const name of Object.keys(field)) names.add(name)
	}
	return [...names]
}

/** Walks up from the plugin root looking for the installed package, the way Node resolves one. A
 *  workspace hoists its dependencies to the repository root, so the first `node_modules` above the
 *  plugin is usually not the one holding them. */
function packageDir(root: string, pkg: string, govFs: GovernanceCopyFs): string | null {
	let dir = path.resolve(root)
	for (;;) {
		const candidate = path.join(dir, 'node_modules', pkg)
		if (govFs.exists(path.join(candidate, 'package.json'))) return candidate
		const parent = path.dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}
