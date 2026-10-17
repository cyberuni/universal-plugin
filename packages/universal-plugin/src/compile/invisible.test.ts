import { describe, expect, it } from 'vitest'

import { escapeInvisible, findInvisible, formatCodePoint, isInvisible } from './invisible.js'

describe('isInvisible', () => {
	it.each(['﻿', '\u0002', '\u001F', '​', '‮', '­', ' ', '️', '\u{E0041}'])('flags %j', (char) =>
		expect(isInvisible(char)).toBe(true))
	it.each(['\t', '\n', '\r', 'a', 'é', '→', ' '])('passes %j', (char) => expect(isInvisible(char)).toBe(false))
})

describe('escapeInvisible', () => {
	const whole = (code: string, kind: 'string' | 'template' | 'regex') =>
		escapeInvisible(code, [{ start: 0, end: code.length, kind }])

	it('escapes inside a span and leaves the rest', () => {
		const code = 'a﻿;"﻿\u0002é"'
		expect(escapeInvisible(code, [{ start: 3, end: code.length, kind: 'string' }])).toBe('a﻿;"\\uFEFF\\u0002é"')
	})

	it('writes an astral code point as a surrogate pair of escapes', () => {
		expect(whole("'\u{E0041}'", 'string')).toBe("'\\uDB40\\uDC41'")
	})

	it('keeps existing escapes and turns an escaped invisible character into an escape', () => {
		expect(whole("'\\n\\\\\\\u0002'", 'string')).toBe("'\\n\\\\\\u0002'")
	})

	it('drops a line continuation over a line separator, outside a regular expression', () => {
		expect(whole("'a\\ b'", 'string')).toBe("'ab'")
		expect(whole('/a\\​/', 'regex')).toBe('/a\\u200B/')
	})

	it('rewrites a mixed literal to the escapes that keep its value', () => {
		expect(whole("'\uFEFF\\\u0002\u{E0041}\\\u2029x'", 'string')).toBe("'\\uFEFF\\u0002\\uDB40\\uDC41x'")
	})
})

describe('findInvisible', () => {
	it('reports line, column and code point', () => {
		expect(findInvisible('ab\n​c﻿')).toEqual([
			{ line: 2, column: 1, codePoint: 0x200b },
			{ line: 2, column: 3, codePoint: 0xfeff },
		])
		expect(formatCodePoint(0x2)).toBe('U+0002')
	})
})
