import { expect, test } from 'vitest'

import { formatCatalogIssues, validateCatalog, validateCatalogContent } from './validation.js'

const validClaude = {
	$schema: 'https://json.schemastore.org/claude-code-marketplace.json',
	name: 'repobuddy',
	owner: { name: 'Ari Vance' },
	plugins: [
		{
			name: 'repobuddy',
			source: './packages/buddy',
			description: 'Agent skills for managing a repository',
			version: '1.3.2',
			homepage: 'https://github.com/repobuddy/repobuddy',
			repository: 'https://github.com/repobuddy/repobuddy.git',
			license: 'MIT',
			keywords: ['agent-skills', 'cli'],
		},
	],
}

test('a generated Claude catalog raises no issue', () => {
	expect(validateCatalog('claude', validClaude)).toEqual([])
	expect(validateCatalog('cursor', validClaude)).toEqual([])
	expect(validateCatalog('copilot', validClaude)).toEqual([])
})

// The two defects that reached a repository unnoticed: both are what `package.json` carries, and
// Claude Code refuses the catalog for either one.
test('an owner written as a string is reported with the object to write instead', () => {
	const issues = validateCatalog('claude', { ...validClaude, owner: 'Ari Vance' })
	expect(issues).toEqual([
		{ path: 'owner', message: 'must be an object with a name, not string — write { "name": "Ari Vance" }' },
	])
})

test('a repository written as an npm object is reported with the string to write instead', () => {
	const issues = validateCatalog('claude', {
		...validClaude,
		plugins: [
			{ ...validClaude.plugins[0], repository: { type: 'git', url: 'https://github.com/repobuddy/repobuddy.git' } },
		],
	})
	expect(issues).toEqual([
		{
			path: 'plugins[0].repository',
			message: 'must be a string, not object — write "https://github.com/repobuddy/repobuddy.git"',
		},
	])
})

test('required keys, entry types, and source shape are checked', () => {
	expect(validateCatalog('claude', { plugins: [] })).toEqual([
		{ path: 'name', message: 'is required' },
		{ path: 'owner', message: 'is required' },
	])
	expect(validateCatalog('claude', { ...validClaude, plugins: [{ name: 'a', source: 'packages/a' }] })).toEqual([
		{
			path: 'plugins[0].source',
			message: 'must be a "./"-prefixed repository-relative path, not "packages/a"',
		},
	])
	expect(validateCatalog('claude', { ...validClaude, plugins: [{ source: './a' }] })).toEqual([
		{ path: 'plugins[0].name', message: 'is required' },
	])
	expect(validateCatalog('claude', { ...validClaude, plugins: 'none' })).toEqual([
		{ path: 'plugins', message: 'must be an array, not string' },
	])
	expect(validateCatalog('claude', ['a'])).toEqual([{ path: '', message: 'catalog must be a JSON object, not array' }])
})

test('a remote source object is accepted in the forms the schema names', () => {
	const entry = (source: unknown) => ({ ...validClaude, plugins: [{ name: 'a', source }] })
	expect(validateCatalog('claude', entry({ source: 'github', repo: 'repobuddy/repobuddy' }))).toEqual([])
	expect(validateCatalog('claude', entry({ source: 'npm', package: 'repobuddy' }))).toEqual([])
	expect(validateCatalog('claude', entry({ source: 'github' }))).toEqual([
		{ path: 'plugins[0].source.repo', message: 'is required' },
	])
	expect(validateCatalog('claude', entry({ source: 'ftp', url: 'x' }))).toEqual([
		{ path: 'plugins[0].source.source', message: 'must be one of npm, url, github, git-subdir' },
	])
})

// Codex reads a document of its own: no owner, an object source, and no required entry version
// (`.research/local-marketplaces`, E-CODEX-M11, E-CODEX-M16).
test('the Codex catalog is judged by Codex rules, not Claude rules', () => {
	const codex = {
		name: 'repobuddy',
		interface: { displayName: 'repobuddy' },
		plugins: [
			{
				name: 'repobuddy',
				source: { source: 'local', path: './packages/buddy' },
				policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
				category: 'Productivity',
			},
		],
	}
	expect(validateCatalog('codex', codex)).toEqual([])
	// The same document under Claude rules: no owner, and a `local` source Claude Code does not know.
	expect(validateCatalog('claude', codex)).toEqual([
		{ path: 'owner', message: 'is required' },
		{ path: 'plugins[0].source.source', message: 'must be one of npm, url, github, git-subdir' },
	])
	expect(
		validateCatalog('codex', { ...codex, plugins: [{ name: 'a', source: { source: 'local', path: 'x' } }] }),
	).toEqual([{ path: 'plugins[0].source.path', message: 'must be a "./"-prefixed repository-relative path, not "x"' }])
})

test('text that does not parse is an issue rather than a thrown error', () => {
	const issues = validateCatalogContent('claude', '{ nope')
	expect(issues).toHaveLength(1)
	expect(issues[0]?.message).toMatch(/is not valid JSON/)
})

test('issues render as one message naming the file and every key', () => {
	const message = formatCatalogIssues('.claude-plugin/marketplace.json', [
		{ path: 'owner', message: 'is required' },
		{ path: 'plugins[0].source', message: 'is required' },
	])
	expect(message).toMatch(/\.claude-plugin\/marketplace\.json/)
	expect(message).toMatch(/owner is required/)
	expect(message).toMatch(/plugins\[0\]\.source is required/)
})
