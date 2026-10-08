/** One parsed `.editorconfig` file: whether it ends the upward search, and its sections in order. */
export interface EditorconfigFile {
	root: boolean
	sections: { glob: string; properties: Record<string, string> }[]
}

export function parseEditorconfig(text: string): EditorconfigFile {
	const file: EditorconfigFile = { root: false, sections: [] }
	let current: Record<string, string> | undefined
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim()
		if (line === '' || line.startsWith('#') || line.startsWith(';')) continue
		const section = /^\[(.*)\]$/.exec(line)
		if (section) {
			current = {}
			file.sections.push({ glob: section[1] as string, properties: current })
			continue
		}
		const eq = line.indexOf('=')
		if (eq < 0) continue
		const key = line.slice(0, eq).trim().toLowerCase()
		const value = line
			.slice(eq + 1)
			.trim()
			.toLowerCase()
		if (current) current[key] = value
		else if (key === 'root') file.root = value === 'true'
	}
	return file
}

/** The indentation the given `.editorconfig` files set for a file, or `undefined` when none sets
 *  `indent_style`. `files` runs from the farthest directory to the nearest, each with the target's
 *  path relative to that file's directory, `/`-separated — so a nearer file and a later section win,
 *  as EditorConfig specifies. */
export function editorconfigIndent(
	files: { config: EditorconfigFile; relativePath: string }[],
): string | number | undefined {
	const props: Record<string, string> = {}
	for (const { config, relativePath } of files) {
		for (const section of config.sections) {
			if (matchesGlob(section.glob, relativePath)) Object.assign(props, section.properties)
		}
	}
	if (props['indent_style'] === 'tab') return '\t'
	if (props['indent_style'] !== 'space') return undefined
	const size = Number(
		props['indent_size'] === 'tab' || props['indent_size'] === undefined ? props['tab_width'] : props['indent_size'],
	)
	return Number.isInteger(size) && size > 0 ? size : 2
}

/** EditorConfig glob matching: a pattern without `/` matches the file name at any depth; one with
 *  `/` is anchored at the `.editorconfig`'s directory. */
export function matchesGlob(glob: string, relativePath: string): boolean {
	const anchored = glob.includes('/')
	const pattern = glob.startsWith('/') ? glob.slice(1) : glob
	const source = anchored ? globToRegex(pattern) : `(?:.*/)?${globToRegex(pattern)}`
	return new RegExp(`^${source}$`).test(relativePath)
}

function globToRegex(glob: string): string {
	let out = ''
	let braces = 0
	for (let i = 0; i < glob.length; i++) {
		const ch = glob[i] as string
		if (ch === '*') {
			if (glob[i + 1] === '*') {
				out += '.*'
				i++
			} else out += '[^/]*'
		} else if (ch === '?') out += '[^/]'
		else if (ch === '[') {
			const close = glob.indexOf(']', i + 1)
			if (close < 0) out += '\\['
			else {
				const body = glob.slice(i + 1, close)
				out += `[${body.startsWith('!') ? `^${body.slice(1)}` : body}]`
				i = close
			}
		} else if (ch === '{') {
			braces++
			out += '(?:'
		} else if (ch === '}' && braces > 0) {
			braces--
			out += ')'
		} else if (ch === ',' && braces > 0) out += '|'
		else if (ch === '\\' && i + 1 < glob.length) out += `\\${glob[++i]}`
		else out += ch.replace(/[.+^$()|\\]/g, '\\$&')
	}
	return out + ')'.repeat(braces)
}
