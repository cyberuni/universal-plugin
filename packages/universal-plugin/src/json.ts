/** Detects indentation style from JSON text. Returns `'\t'` for tabs or a number for space count.
 *  Falls back to `'\t'` when no indentation is detected. */
export function detectIndent(json: string): string | number {
	return findIndent(json) ?? '\t'
}

/** The indentation JSON text was written with, or `undefined` when it has none to read — a
 *  single-line or empty document says nothing about how the repository indents. */
export function findIndent(json: string): string | number | undefined {
	const match = json.match(/\n([ \t]+)/)
	if (!match) return undefined
	return match[1].startsWith('\t') ? '\t' : match[1].length
}

export interface FormatJsonOptions {
	/** The text currently on disk at the target path. Its indentation, line ending and trailing
	 *  newline are kept, and every value the write leaves unchanged keeps its original text. */
	existing?: string | undefined
	/** The indentation to use when `existing` has none to read. Defaults to a tab. */
	indent?: string | number | undefined
}

/** Serializes `value` the way the file it overwrites was written, so the repository's own
 *  formatter has nothing to undo (issue #164). A value equal to the one already at the same place
 *  in `existing` is copied verbatim — a formatter's collapsed array stays collapsed — and only what
 *  changed is laid out fresh, one entry per line. With no `existing` this is
 *  `JSON.stringify(value, null, indent)` plus a trailing newline. */
export function formatJson(value: unknown, options: FormatJsonOptions = {}): string {
	const { existing } = options
	const plain: unknown = JSON.parse(JSON.stringify(value) ?? 'null')
	const found = existing === undefined ? undefined : findIndent(existing)
	const indent = found ?? options.indent ?? '\t'
	const unit = typeof indent === 'number' ? ' '.repeat(indent) : indent
	const eol = existing?.includes('\r\n') ? '\r\n' : '\n'
	// Reusing text only makes sense when the old file was laid out over lines: a minified file's
	// subtrees would come back minified inside an indented document.
	const tree = existing !== undefined && found !== undefined ? parseWithSpans(existing) : undefined
	const body = write(plain, tree, 0, { unit, eol, text: existing ?? '' })
	const trailing = existing === undefined ? '\n' : (/\r?\n$/.exec(existing)?.[0] ?? '')
	return `${body}${trailing}`
}

interface Layout {
	unit: string
	eol: string
	text: string
}

function write(value: unknown, node: SpanNode | undefined, depth: number, layout: Layout): string {
	if (node && deepEqual(value, node.value)) return layout.text.slice(node.start, node.end)
	const inner = layout.unit.repeat(depth + 1)
	const outer = layout.unit.repeat(depth)
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]'
		const items = value.map((item, i) => `${inner}${write(item, node?.items?.[i], depth + 1, layout)}`)
		return `[${layout.eol}${items.join(`,${layout.eol}`)}${layout.eol}${outer}]`
	}
	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value)
		if (entries.length === 0) return '{}'
		const members = entries.map(
			([key, member]) => `${inner}${JSON.stringify(key)}: ${write(member, node?.members?.get(key), depth + 1, layout)}`,
		)
		return `{${layout.eol}${members.join(`,${layout.eol}`)}${layout.eol}${outer}}`
	}
	return JSON.stringify(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (Array.isArray(a)) {
		return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
	}
	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(b)) return false
	const aKeys = Object.keys(a)
	const bKeys = Object.keys(b)
	// Key order is part of the text: a reordered object is laid out fresh rather than copied.
	return (
		aKeys.length === bKeys.length &&
		aKeys.every(
			(key, i) =>
				key === bKeys[i] && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
		)
	)
}

interface SpanNode {
	start: number
	end: number
	value: unknown
	items?: SpanNode[]
	members?: Map<string, SpanNode>
}

/** Parses JSON text recording where each value sits in it. Returns `undefined` for anything that
 *  is not strict JSON (comments, trailing commas), which then gets no text reused. */
function parseWithSpans(text: string): SpanNode | undefined {
	let pos = 0
	const fail = (): never => {
		throw new SyntaxError(`Unexpected input at ${pos}`)
	}
	const skip = () => {
		while (pos < text.length && ' \t\r\n'.includes(text[pos] as string)) pos++
	}
	const parseValue = (): SpanNode => {
		skip()
		const start = pos
		const ch = text[pos]
		if (ch === '{') {
			pos++
			const members = new Map<string, SpanNode>()
			const value: Record<string, unknown> = {}
			skip()
			if (text[pos] === '}') pos++
			else {
				for (;;) {
					skip()
					if (text[pos] !== '"') fail()
					const keyStart = pos
					scanString()
					const key = JSON.parse(text.slice(keyStart, pos)) as string
					skip()
					if (text[pos] !== ':') fail()
					pos++
					const member = parseValue()
					members.set(key, member)
					value[key] = member.value
					skip()
					if (text[pos] === ',') pos++
					else if (text[pos] === '}') {
						pos++
						break
					} else fail()
				}
			}
			return { start, end: pos, value, members }
		}
		if (ch === '[') {
			pos++
			const items: SpanNode[] = []
			skip()
			if (text[pos] === ']') pos++
			else {
				for (;;) {
					items.push(parseValue())
					skip()
					if (text[pos] === ',') pos++
					else if (text[pos] === ']') {
						pos++
						break
					} else fail()
				}
			}
			return { start, end: pos, value: items.map((item) => item.value), items }
		}
		if (ch === '"') scanString()
		else {
			const match = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(pos))
			if (!match) fail()
			pos += (match as RegExpExecArray)[0].length
		}
		return { start, end: pos, value: JSON.parse(text.slice(start, pos)) }
	}
	const scanString = () => {
		pos++
		while (pos < text.length && text[pos] !== '"') pos += text[pos] === '\\' ? 2 : 1
		if (pos >= text.length) fail()
		pos++
	}
	try {
		const root = parseValue()
		skip()
		return pos === text.length ? root : undefined
	} catch {
		return undefined
	}
}
