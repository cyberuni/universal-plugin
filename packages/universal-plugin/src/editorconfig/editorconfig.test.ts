import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { editorconfigIndent, matchesGlob, parseEditorconfig } from './editorconfig.js'
import { readEditorconfigIndent } from './fs.js'

function indentFor(text: string, relativePath: string) {
	return editorconfigIndent([{ config: parseEditorconfig(text), relativePath }])
}

describe('editorconfigIndent', () => {
	it('reads indent_style tab', () => {
		expect(indentFor('[*]\nindent_style = tab\n', 'plugin.json')).toBe('\t')
	})

	it('reads indent_style space with indent_size', () => {
		expect(indentFor('[*]\nindent_style = space\nindent_size = 4\n', 'plugin.json')).toBe(4)
	})

	it('a later matching section wins', () => {
		expect(
			indentFor('[*]\nindent_style = tab\n\n[*.json]\nindent_style = space\nindent_size = 2\n', 'a/plugin.json'),
		).toBe(2)
	})

	it('ignores sections that do not match', () => {
		expect(indentFor('[*.md]\nindent_style = tab\n', 'plugin.json')).toBeUndefined()
	})

	it('sets nothing without indent_style', () => {
		expect(indentFor('[*]\nindent_size = 4\n', 'plugin.json')).toBeUndefined()
	})
})

describe('matchesGlob', () => {
	it('matches a slashless pattern at any depth', () => {
		expect(matchesGlob('*.json', 'a/b/plugin.json')).toBe(true)
		expect(matchesGlob('*.{json,jsonc}', 'x.jsonc')).toBe(true)
		expect(matchesGlob('*.json', 'plugin.jsonc')).toBe(false)
	})

	it('anchors a pattern with a slash at the config directory', () => {
		expect(matchesGlob('/src/*.json', 'src/a.json')).toBe(true)
		expect(matchesGlob('src/*.json', 'pkg/src/a.json')).toBe(false)
		expect(matchesGlob('src/**.json', 'src/a/b.json')).toBe(true)
	})
})

describe('readEditorconfigIndent', () => {
	let dir: string
	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-plugin-editorconfig-'))
	})
	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true })
	})

	it('lets a nearer file override a farther one, and stops at root = true', () => {
		fs.writeFileSync(path.join(dir, '.editorconfig'), 'root = true\n[*]\nindent_style = tab\n')
		fs.mkdirSync(path.join(dir, 'pkg'))
		fs.writeFileSync(path.join(dir, 'pkg', '.editorconfig'), '[*.json]\nindent_style = space\nindent_size = 2\n')
		expect(readEditorconfigIndent(path.join(dir, 'pkg', 'plugin.json'))).toBe(2)
		expect(readEditorconfigIndent(path.join(dir, 'pkg', 'README.md'))).toBe('\t')
	})

	it('returns undefined when no file sets an indent', () => {
		fs.writeFileSync(path.join(dir, '.editorconfig'), 'root = true\n')
		expect(readEditorconfigIndent(path.join(dir, 'plugin.json'))).toBeUndefined()
	})
})
