import { expect, test } from 'vitest'
import { compareLauncher, composeLauncher, parseLauncherEntries, publishedFilesWarning } from './launcher.js'

test('parses a map of command name to entry', () => {
	expect(parseLauncherEntries({ 'cyber-asana': './dist/cli.js' })).toEqual({
		entries: [{ name: 'cyber-asana', entry: 'dist/cli.js' }],
		errors: [],
	})
})

test('an absent declaration is no launcher and no error', () => {
	expect(parseLauncherEntries(undefined)).toEqual({ entries: [], errors: [] })
})

test.each([
	['a non-map', ['x'], /not a map/],
	['a path as a name', { 'bin/x': 'dist/cli.js' }, /plain command name/],
	['a non-string entry', { x: 1 }, /entry path/],
	['an entry that leaves the plugin', { x: '../cli.js' }, /not a path inside the plugin/],
	['an absolute entry', { x: '/usr/bin/node' }, /not a path inside the plugin/],
])('rejects %s', (_label, declaration, message) => {
	const { entries, errors } = parseLauncherEntries(declaration)
	expect(entries).toEqual([])
	expect(errors.join('\n')).toMatch(message)
})

test('the shim is a sh script that runs the entry beside its own location', () => {
	const shim = composeLauncher({ name: 'cyber-asana', entry: 'dist/cli.js' }, 'cyber-asana')
	expect(shim.startsWith('#!/bin/sh\n')).toBe(true)
	expect(shim).toContain('entry="$root/dist/cli.js"')
	expect(shim).toContain('exec node "$entry" "$@"')
	expect(shim).toContain('npx -y cyber-asana')
})

test('a plugin with no package names no npx fallback', () => {
	expect(composeLauncher({ name: 'x', entry: 'cli.js' }, null)).not.toContain('npx')
})

test('compares by content and executable bit', () => {
	const shim = composeLauncher({ name: 'x', entry: 'cli.js' }, null)
	expect(compareLauncher(null, shim)).toBe('missing')
	expect(compareLauncher({ content: shim, mode: 0o755 }, shim)).toBe('unchanged')
	expect(compareLauncher({ content: shim, mode: 0o644 }, shim)).toBe('stale')
	expect(compareLauncher({ content: 'old', mode: 0o755 }, shim)).toBe('stale')
})

test.each([
	[undefined, null],
	[['bin', 'dist'], null],
	[['./bin/'], null],
	[['dist'], expect.stringMatching(/does not list "bin"/)],
])('files %j', (files, expected) => {
	expect(publishedFilesWarning(files)).toEqual(expected)
})
