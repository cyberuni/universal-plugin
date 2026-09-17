/** The governance copy step: a governance is copied into every skill that uses it at build time and
 *  read from disk at run time, so a skill never pays a registry lookup to read a rule set it was
 *  tested against (repobuddy/buddy-agent-harness#122).
 *
 *  The files already present in `<skill>/references/governances/` ARE the declaration of which
 *  governances that skill uses — nothing is declared in plugin.json. The build refreshes every file
 *  in that folder from its owning package, adds the governances those files reference, and fails
 *  when a file names no governance or when SKILL.md does not list a copy. */

/** Where a skill's copies live, relative to the skill folder. Posix spelling: it is both a path
 *  segment and the text a SKILL.md References section has to carry. */
export const SKILL_GOVERNANCE_DIR = 'references/governances'

/** A retrieval pointer inside a governance body: `<runner> <package> governance show <name>`, or the
 *  bare `governance show <name>` in prose. Only the trailing two words carry meaning here — which
 *  package shipped the command is exactly what the copy step removes. */
const POINTER = /governance show\s+([A-Za-z0-9][A-Za-z0-9._/-]*)/g

/** A fenced code block opener or closer, with any indentation and info string. */
const FENCE = /^\s*(?:```|~~~)/

/** Indentation, plus a list marker when the pointer is a bullet. A pointer listed under References
 *  is usually one bullet among several, and an instruction that loses the bullet leaves the list. */
const LINE_PREFIX = /^\s*(?:[-*+]\s+|\d+\.\s+)?/

/** The copy's name for a pointer token: a namespaced `<plugin>/<name>` lookup and a plain `<name>`
 *  resolve to the same document, so both land in the same file. */
export function governanceName(token: string): string {
	const slash = token.lastIndexOf('/')
	const name = slash === -1 ? token : token.slice(slash + 1)
	return name.endsWith('.md') ? name.slice(0, -3) : name
}

/** The governances a governance body points at, in first-appearance order, deduplicated. */
export function referencedGovernances(content: string): string[] {
	const names: string[] = []
	for (const match of content.matchAll(POINTER)) {
		const token = match[1]
		if (!token) continue
		const name = governanceName(token)
		if (!names.includes(name)) names.push(name)
	}
	return names
}

/** The instruction a pointer becomes. Stated once so the rewriter and its tests cannot drift. */
export function loadInstruction(name: string): string {
	return `Load \`${SKILL_GOVERNANCE_DIR}/${name}.md\` if it is not already loaded.`
}

interface RewrittenLine {
	lines: string[]
	rewritten: boolean
	fence: boolean
}

/** Rewrites every retrieval pointer in a copy into an instruction to load the sibling copy. The
 *  Agent Skills specification asks that every file an agent needs is one level deep from SKILL.md,
 *  so a copy must never send the agent back to a command to reach the next document.
 *
 *  A fenced block whose every line was a pointer is unwrapped: prose in a bash fence reads as a
 *  command to run. A block that mixes pointers with real commands keeps its fence. */
export function rewriteGovernancePointers(content: string): string {
	const eol = content.includes('\r\n') ? '\r\n' : '\n'
	const entries: RewrittenLine[] = content.split(/\r?\n/).map((line) => {
		if (FENCE.test(line)) return { lines: [line], rewritten: false, fence: true }
		const names = referencedGovernances(line)
		if (names.length === 0) return { lines: [line], rewritten: false, fence: false }
		const prefix = LINE_PREFIX.exec(line)?.[0] ?? ''
		// Only the first instruction can keep a bullet; a second one on the same line is its own item,
		// so it repeats the marker rather than running on.
		return { lines: names.map((name) => `${prefix}${loadInstruction(name)}`), rewritten: true, fence: false }
	})

	const out: string[] = []
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i] as RewrittenLine
		if (!entry.fence) {
			out.push(...entry.lines)
			continue
		}
		const close = entries.findIndex((e, j) => j > i && e.fence)
		const inner = close === -1 ? [] : entries.slice(i + 1, close)
		const allRewritten =
			close !== -1 &&
			inner.some((e) => e.rewritten) &&
			inner.every((e) => e.rewritten || e.lines.every((l) => l.trim() === ''))
		if (!allRewritten) {
			out.push(...entry.lines)
			continue
		}
		for (const e of inner) out.push(...e.lines)
		i = close
	}
	return out.join(eol)
}

/** The copies a SKILL.md fails to list under References. The specification asks SKILL.md to
 *  reference every file directly, so a copy no References section names is a file the agent has no
 *  documented way to reach. */
export function unlistedGovernanceCopies(skillMd: string, names: string[]): string[] {
	const section = referencesSection(skillMd)
	return names.filter((name) => !section.includes(`${SKILL_GOVERNANCE_DIR}/${name}.md`))
}

/** The body of the References section, or the empty string when the document has none. */
function referencesSection(skillMd: string): string {
	const lines = skillMd.split(/\r?\n/)
	const start = lines.findIndex((line) => /^(#{1,6})\s+references\b/i.test(line))
	if (start === -1) return ''
	const level = (/^(#{1,6})/.exec(lines[start] as string)?.[1] ?? '#').length
	let end = lines.length
	for (let i = start + 1; i < lines.length; i++) {
		const heading = /^(#{1,6})\s/.exec(lines[i] as string)
		if (heading && (heading[1] as string).length <= level) {
			end = i
			break
		}
	}
	return lines.slice(start + 1, end).join('\n')
}
