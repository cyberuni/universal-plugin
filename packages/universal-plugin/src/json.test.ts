import { describe, expect, it } from 'vitest'
import { detectIndent, findIndent, formatJson } from './json.js'

describe('findIndent', () => {
	it('reads tabs and space counts', () => {
		expect(findIndent('{\n\t"a": 1\n}')).toBe('\t')
		expect(findIndent('{\n    "a": 1\n}')).toBe(4)
	})

	it('has nothing to read in a single-line document', () => {
		expect(findIndent('{"a":1}')).toBeUndefined()
		expect(detectIndent('{"a":1}')).toBe('\t')
	})
})

describe('formatJson', () => {
	it('writes a new file with the given indentation and a trailing newline', () => {
		expect(formatJson({ a: [1, 2] }, { indent: 2 })).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}\n')
	})

	it('defaults a new file to tabs', () => {
		expect(formatJson({ a: 1 })).toBe('{\n\t"a": 1\n}\n')
	})

	it('keeps the existing file indentation over the given fallback', () => {
		expect(formatJson({ a: 2 }, { existing: '{\n\t"a": 1\n}\n', indent: 2 })).toBe('{\n\t"a": 2\n}\n')
	})

	it('uses the fallback when the existing file has no indentation to read', () => {
		expect(formatJson({ a: 2 }, { existing: '{"a":1}\n', indent: 4 })).toBe('{\n    "a": 2\n}\n')
	})

	it('keeps a missing trailing newline missing', () => {
		expect(formatJson({ a: 2 }, { existing: '{\n\t"a": 1\n}' })).toBe('{\n\t"a": 2\n}')
	})

	it('keeps CRLF line endings', () => {
		expect(formatJson({ a: 2, b: 3 }, { existing: '{\r\n\t"a": 1\r\n}\r\n' })).toBe(
			'{\r\n\t"a": 2,\r\n\t"b": 3\r\n}\r\n',
		)
	})

	it('leaves an unchanged collapsed array as the formatter wrote it', () => {
		const existing = '{\n\t"version": "0.8.0",\n\t"keywords": ["a", "b"],\n\t"skills": { "paths": ["./skills/"] }\n}\n'
		const value = { version: '0.9.0', keywords: ['a', 'b'], skills: { paths: ['./skills/'] } }
		expect(formatJson(value, { existing })).toBe(existing.replace('0.8.0', '0.9.0'))
	})

	it('returns an unchanged document byte for byte', () => {
		const existing = '{\n  "a": [1, 2],\n  "b": { "c": 1.0 }\n}\n'
		expect(formatJson({ a: [1, 2], b: { c: 1 } }, { existing })).toBe(existing)
	})

	it('lays out a changed array fresh', () => {
		const existing = '{\n\t"keywords": ["a", "b"]\n}\n'
		expect(formatJson({ keywords: ['a', 'c'] }, { existing })).toBe('{\n\t"keywords": [\n\t\t"a",\n\t\t"c"\n\t]\n}\n')
	})

	it('reuses nothing from a document that is not strict JSON', () => {
		const existing = '{\n\t// note\n\t"keywords": ["a"]\n}\n'
		expect(formatJson({ keywords: ['a'] }, { existing })).toBe('{\n\t"keywords": [\n\t\t"a"\n\t]\n}\n')
	})

	it('drops undefined members the way JSON.stringify does', () => {
		expect(formatJson({ a: undefined, b: 1 })).toBe('{\n\t"b": 1\n}\n')
	})
})
