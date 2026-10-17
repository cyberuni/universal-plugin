/** Invisible characters in compiled output (issue #190).
 *
 *  A bundler prints a dependency's `'\u{FEFF}'` as the raw character, so a committed script holds
 *  code points a reader cannot see — the ones skill checks reject because they can hide
 *  instructions. Inside a string, template or regular-expression literal the character can be
 *  written as an escape with the same meaning; anywhere else it can only be reported. */

/** Controls, format characters (zero-width, bidirectional, BOM, soft hyphen, tags), line and paragraph
 *  separators, and default-ignorable code points such as variation selectors. Tab, line feed and
 *  carriage return are ordinary whitespace. */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u

export function isInvisible(char: string): boolean {
	return char !== '\t' && char !== '\n' && char !== '\r' && INVISIBLE.test(char)
}

/** A literal's source range (UTF-16 offsets, end exclusive) whose characters may be escaped. A tagged
 *  template is never one: its tag can read the raw text, which an escape changes. */
export interface LiteralSpan {
	start: number
	end: number
	kind: 'string' | 'template' | 'regex'
}

/** `\uXXXX` per UTF-16 code unit — valid in strings, templates and regular expressions, with or
 *  without the `u` flag (a surrogate pair of escapes reads as one code point under `u`). */
function escapeChar(char: string): string {
	let out = ''
	for (let i = 0; i < char.length; i++) out += `\\u${char.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')}`
	return out
}

/** Rewrites every invisible character inside `spans` as an escape that keeps the literal's value. */
export function escapeInvisible(code: string, spans: readonly LiteralSpan[]): string {
	const sorted = [...spans].sort((a, b) => a.start - b.start)
	let out = ''
	let copied = 0
	for (const span of sorted) {
		if (span.start < copied) continue
		out += code.slice(copied, span.start)
		out += escapeSpan(code.slice(span.start, span.end), span.kind)
		copied = span.end
	}
	return out + code.slice(copied)
}

function escapeSpan(text: string, kind: LiteralSpan['kind']): string {
	let out = ''
	let i = 0
	while (i < text.length) {
		const char = String.fromCodePoint(text.codePointAt(i) as number)
		if (char !== '\\') {
			out += isInvisible(char) ? escapeChar(char) : char
			i += char.length
			continue
		}
		const next = i + 1 < text.length ? String.fromCodePoint(text.codePointAt(i + 1) as number) : ''
		i += 1 + next.length
		if (!isInvisible(next)) out += `\\${next}`
		// A backslash before a line or paragraph separator is a line continuation: it contributes nothing.
		else if (kind !== 'regex' && (next === ' ' || next === ' ')) continue
		// Any other escaped invisible character is an identity escape: it stands for itself.
		else out += escapeChar(next)
	}
	return out
}

export interface InvisibleCharacter {
	line: number
	column: number
	codePoint: number
}

/** Every invisible character left in `code`, 1-based line and column, for the build to warn about. */
export function findInvisible(code: string): InvisibleCharacter[] {
	const found: InvisibleCharacter[] = []
	let line = 1
	let column = 1
	for (const char of code) {
		if (char === '\n') {
			line++
			column = 1
			continue
		}
		if (isInvisible(char)) found.push({ line, column, codePoint: char.codePointAt(0) as number })
		column++
	}
	return found
}

export function formatCodePoint(codePoint: number): string {
	return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
}
