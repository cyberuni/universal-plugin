/** Relative Markdown links that leave a skill's folder (issue #177).
 *
 *  A skill does not always travel with its package: pnpm links or copies each skill folder on its own
 *  into an agent's skill directory, and a plugin cache keeps only what the plugin ships. A link such
 *  as `../../readme.md` then points at nothing, or at whatever happens to sit beside the copy. No I/O:
 *  the caller reads the file and says where it sits inside the skill. */

/** A link target outside the skill folder, as written in the file. */
export interface EscapingLink {
	target: string
	line: number
}

/** Inline links and images, `[text](target)` and `![alt](target "title")`. */
const INLINE_LINK = /!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g
/** Reference definitions, `[label]: target`. */
const REFERENCE_DEFINITION = /^\s{0,3}\[[^\]\n]+\]:\s*<?(\S+?)>?(?:\s|$)/
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

/** The relative links in `content` whose target resolves outside the skill folder. `fileInSkill` is
 *  the file's path relative to the skill folder, `/`-separated (`SKILL.md`, `references/a.md`).
 *  Fenced code is skipped: a link there is an example, not one the agent follows. */
export function escapingLinks(content: string, fileInSkill: string): EscapingLink[] {
	const fileDir = fileInSkill.split('/').slice(0, -1)
	const found: EscapingLink[] = []
	let fence: string | null = null
	const lines = content.split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? ''
		const marker = line.match(FENCE)?.[1]
		if (marker !== undefined) {
			if (fence === null) fence = marker[0]!
			else if (marker[0] === fence) fence = null
			continue
		}
		if (fence !== null) continue
		const targets = [...line.replace(/`[^`]*`/g, '').matchAll(INLINE_LINK)].map((m) => m[1]!)
		const definition = line.match(REFERENCE_DEFINITION)?.[1]
		if (definition !== undefined) targets.push(definition)
		for (const target of targets) {
			if (leavesSkill(fileDir, target)) found.push({ target, line: i + 1 })
		}
	}
	return found
}

/** True when a relative `target`, resolved from `fileDir` inside the skill, climbs above the skill
 *  folder. A URL, an absolute path and a bare anchor are never relative links. */
function leavesSkill(fileDir: string[], target: string): boolean {
	if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/') || target.startsWith('#')) return false
	const pathPart = target.split(/[?#]/)[0] ?? ''
	const segments = [...fileDir]
	for (const segment of pathPart.split('/')) {
		if (segment === '' || segment === '.') continue
		if (segment !== '..') segments.push(segment)
		else if (segments.length === 0) return true
		else segments.pop()
	}
	return false
}
