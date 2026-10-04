import { describe, expect, it } from 'vitest'
import {
	catalogDependencyIssues,
	dependencyCatalogEntries,
	translateDependencies,
	validateDependencies,
} from './dependencies.js'

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

describe('validateDependencies — source', () => {
	it('accepts a tagged source on the object form', () => {
		expect(
			validateDependencies([{ name: 'cyber-asana', source: { source: 'npm', package: 'cyber-asana' } }]).errors,
		).toEqual([])
	})

	it('rejects a source that is not a tagged object', () => {
		expect(validateDependencies([{ name: 'cyber-asana', source: 'npm:cyber-asana' }]).errors).toEqual([
			'dependencies[0].source must be a catalog source such as { "source": "npm", "package": "cyber-asana" }',
		])
	})
})

describe('translateDependencies — source', () => {
	it('strips source from what claude-code receives: it locates the entry for the catalog, not the runtime', () => {
		const result = translateDependencies(
			[{ name: 'cyber-asana', version: '^0.9.0', source: { source: 'npm', package: 'cyber-asana' } }],
			'claude-code',
		)
		expect(result.dependencies).toEqual([{ name: 'cyber-asana', version: '^0.9.0' }])
	})
})

describe('dependencyCatalogEntries', () => {
	it('lists each bare dependency that carries a source', () => {
		expect(
			dependencyCatalogEntries(
				['plain', { name: 'cyber-asana', source: { source: 'npm', package: 'cyber-asana' } }],
				'local',
			),
		).toEqual([{ name: 'cyber-asana', source: { source: 'npm', package: 'cyber-asana' } }])
	})

	it('counts a dependency qualified with this catalog own name as local', () => {
		expect(
			dependencyCatalogEntries([{ name: 'a', marketplace: 'local', source: { source: 'npm', package: 'a' } }], 'local'),
		).toEqual([{ name: 'a', source: { source: 'npm', package: 'a' } }])
	})

	it('never adds a dependency another marketplace resolves', () => {
		expect(
			dependencyCatalogEntries([{ name: 'a', marketplace: 'other', source: { source: 'npm', package: 'a' } }], 'local'),
		).toEqual([])
	})
})

describe('catalogDependencyIssues', () => {
	const catalog = { path: '.claude-plugin/marketplace.json', name: 'uip-pods-local', plugins: ['uip-pods'] }

	it('says nothing when every bare dependency is listed', () => {
		expect(catalogDependencyIssues(['uip-pods'], { ...catalog, plugins: ['uip-pods'] })).toEqual([])
	})

	it('names a bare dependency the catalog does not list, and both fixes', () => {
		expect(catalogDependencyIssues(['cyber-asana'], catalog)).toEqual([
			'dependency "cyber-asana" is not listed in ".claude-plugin/marketplace.json" (marketplace "uip-pods-local"), and a bare name resolves only there — list it in that catalog (universal-plugin marketplace add npm:<package>), or qualify it with the marketplace that lists it ({ "name": "cyber-asana", "marketplace": "<marketplace>" }) and add that marketplace to the catalog\'s allowCrossMarketplaceDependenciesOn',
		])
	})

	it('reads a range tail and the object form by name', () => {
		expect(catalogDependencyIssues(['uip-pods@^1.0.0', { name: 'uip-pods', version: '^1.0.0' }], catalog)).toEqual([])
	})

	it('treats a dependency qualified with the catalog own name as bare', () => {
		expect(catalogDependencyIssues(['cyber-asana@uip-pods-local'], catalog)).toHaveLength(1)
		expect(catalogDependencyIssues(['uip-pods@uip-pods-local'], catalog)).toEqual([])
	})

	it('names a cross-marketplace dependency the catalog does not allow', () => {
		expect(catalogDependencyIssues([{ name: 'cyber-asana', marketplace: 'cyberuni' }], catalog)).toEqual([
			'dependency "cyber-asana@cyberuni" names marketplace "cyberuni", which ".claude-plugin/marketplace.json" (marketplace "uip-pods-local") does not list in allowCrossMarketplaceDependenciesOn, so the dependency is refused at install — add "cyberuni" to that list',
		])
	})

	it('accepts a cross-marketplace dependency the catalog allows', () => {
		expect(
			catalogDependencyIssues(['cyber-asana@cyberuni'], { ...catalog, allowedMarketplaces: ['cyberuni'] }),
		).toEqual([])
	})

	it('skips an entry whose shape is invalid — validation already reported it', () => {
		expect(catalogDependencyIssues([42, 'Not A Name!'], catalog)).toEqual([])
	})

	it('says nothing for an absent declaration', () => {
		expect(catalogDependencyIssues(undefined, catalog)).toEqual([])
	})
})
