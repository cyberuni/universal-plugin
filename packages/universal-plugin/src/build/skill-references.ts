/** pnpm names for cross-skill references.
 *
 *  pnpm links each skill as `pnpm-<package>-<skill>` (a scoped `@scope/name` becomes
 *  `pnpm-@scope+name-<skill>`), so a reference written as `/<plugin>:<skill>` resolves to nothing
 *  there. The build writes both names side by side; authors write `/<plugin>:<skill>` once. No I/O:
 *  the caller says which plugin and skills the package ships and what its npm name is. */

/** What a reference can be resolved against: the plugin the package ships and its npm name. */
export interface SkillReferenceTarget {
	plugin: string
	packageName: string
	skills: ReadonlySet<string>
}

/** The folder name pnpm gives a skill: `pnpm-<package>-<skill>`, with `/` in the package as `+`. */
export function pnpmSkillName(packageName: string, skill: string): string {
	return `pnpm-${packageName.replace(/\//g, '+')}-${skill}`
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/
/** `/plugin:skill`, bare or alone in an inline code span. A span that holds more (`/p:s --flag`) is a
 *  command example and stays as written. */
const REFERENCE = /(`?)(?<![\w/.:@-])\/([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)(?![\w:/-])(`?)/g
const ALREADY = ' (pnpm install: `'

/** `content` with the pnpm name added after each reference this package can resolve:
 *  `/<plugin>:<skill>` (pnpm install: `pnpm-<package>-<skill>`). A reference that already carries
 *  it, one to another plugin or an unknown skill, and anything inside fenced code is left alone, so
 *  a rebuild changes nothing. Fences are skipped whole: the added text would break a command. */
export function addPnpmNames(content: string, target: SkillReferenceTarget): string {
	let fence: string | null = null
	return content
		.split(/(\r?\n)/)
		.map((line) => {
			const marker = line.match(FENCE)?.[1]
			if (marker !== undefined) {
				if (fence === null) fence = marker[0]!
				else if (marker[0] === fence) fence = null
				return line
			}
			if (fence !== null) return line
			return line.replace(
				REFERENCE,
				(match, open: string, plugin: string, skill: string, close: string, offset: number) => {
					if (open !== close || plugin !== target.plugin || !target.skills.has(skill)) return match
					if (line.startsWith(ALREADY, offset + match.length)) return match
					const written = open === '' ? `\`/${plugin}:${skill}\`` : match
					return `${written}${ALREADY}${pnpmSkillName(target.packageName, skill)}\`)`
				},
			)
		})
		.join('')
}
