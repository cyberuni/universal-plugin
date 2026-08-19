import { describe, expect, it } from 'vitest'
import { translateDependencies, validateDependencies } from './dependencies.js'

describe('validateDependencies', () => {
	it('accepts a bare plugin name', () => {
		expect(validateDependencies(['cyber-asana']).errors).toEqual([])
	})

	it('accepts a marketplace-qualified name', () => {
		expect(validateDependencies(['cyber-asana@cyberuni']).errors).toEqual([])
	})

	it('accepts the object form with a semver range', () => {
		expect(validateDependencies([{ name: 'cyber-asana', marketplace: 'cyberuni', version: '^0.9.0' }]).errors).toEqual(
			[],
		)
	})

	it('accepts the object form pinned to a commit sha', () => {
		expect(validateDependencies([{ name: 'cyber-asana', sha: 'a1b2c3d' }]).errors).toEqual([])
	})

	it('accepts an absent declaration', () => {
		expect(validateDependencies(undefined).errors).toEqual([])
	})

	it('rejects the npm-style object map — Claude Code reads an array', () => {
		expect(validateDependencies({ 'cyber-asana': '^0.9.0' }).errors).toEqual([
			'dependencies must be an array of plugin names or objects, not an object map',
		])
	})

	it('rejects an entry that is neither a string nor an object', () => {
		expect(validateDependencies([42]).errors).toEqual([
			'dependencies[0] must be a plugin name or an object with a name',
		])
	})

	it('rejects an object entry without a name', () => {
		expect(validateDependencies([{ version: '^1.0.0' }]).errors).toEqual([
			'dependencies[0] must be a plugin name or an object with a name',
		])
	})

	it('rejects a name the runtime cannot parse', () => {
		expect(validateDependencies(['Not A Name!']).errors).toEqual([
			'dependencies[0] "Not A Name!" is not a plugin name, optionally qualified with @marketplace',
		])
	})

	it('rejects a range in the string form that is not caret-prefixed', () => {
		// Claude Code's dependency pattern admits only an `@^…` tail; `dep@>=1.0.0` fails to parse and
		// takes the whole manifest with it.
		expect(validateDependencies(['cyber-asana@>=1.0.0']).errors).toEqual([
			'dependencies[0] "cyber-asana@>=1.0.0" is not a plugin name, optionally qualified with @marketplace',
		])
	})

	it('rejects a version that is not a semver range', () => {
		expect(validateDependencies([{ name: 'cyber-asana', version: 'latest' }]).errors).toEqual([
			'dependencies[0].version "latest" is not a semver range',
		])
	})

	it('warns that a range in the string form is discarded, and names the form that is enforced', () => {
		const result = validateDependencies(['cyber-asana@cyberuni@^0.9.0'])
		expect(result.errors).toEqual([])
		expect(result.warnings).toEqual([
			'dependencies[0] "cyber-asana@cyberuni@^0.9.0" carries a version range the runtime discards — declare { "name": "cyber-asana", "marketplace": "cyberuni", "version": "^0.9.0" } for a range that is enforced',
		])
	})

	it('warns once per offending entry', () => {
		expect(validateDependencies(['a@^1.0.0', 'b@^2.0.0']).warnings).toHaveLength(2)
	})
})

describe('translateDependencies', () => {
	it('delivers the declaration to claude-code unchanged', () => {
		const declared = ['cyber-asana', { name: 'other', version: '^1.0.0' }]
		const result = translateDependencies(declared, 'claude-code')
		expect(result.dependencies).toEqual(declared)
		expect(result.warnings).toEqual([])
	})

	it('drops the declaration for cursor and warns', () => {
		const result = translateDependencies(['cyber-asana'], 'cursor')
		expect(result.dependencies).toBeNull()
		expect(result.warnings).toEqual([
			'cursor does not read plugin dependencies — "cyber-asana" is dropped from the derived manifest',
		])
	})

	it('drops the declaration for codex and warns', () => {
		const result = translateDependencies(['cyber-asana'], 'codex')
		expect(result.dependencies).toBeNull()
		expect(result.warnings).toEqual([
			'codex does not read plugin dependencies — "cyber-asana" is dropped from the derived manifest',
		])
	})

	it('reports the declaration as ignored at runtime for copilot-cli, which has no derived manifest', () => {
		const result = translateDependencies(['cyber-asana'], 'copilot-cli')
		expect(result.dependencies).toBeNull()
		expect(result.warnings).toEqual([
			'copilot-cli does not read plugin dependencies — "cyber-asana" is ignored at runtime',
		])
	})

	it('names every dropped dependency in one warning per vendor', () => {
		const result = translateDependencies(['a', { name: 'b', marketplace: 'mkt' }], 'codex')
		expect(result.warnings).toEqual([
			'codex does not read plugin dependencies — "a", "b@mkt" are dropped from the derived manifest',
		])
	})

	it('says nothing when nothing is declared', () => {
		expect(translateDependencies([], 'codex')).toEqual({ dependencies: null, warnings: [] })
	})

	it('passes the declaration through for a vendor it knows nothing about', () => {
		const result = translateDependencies(['cyber-asana'], 'some-future-runtime')
		expect(result.dependencies).toEqual(['cyber-asana'])
		expect(result.warnings).toEqual([])
	})
})
