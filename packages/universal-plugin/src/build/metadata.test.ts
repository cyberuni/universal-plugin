import { describe, expect, it } from 'vitest'
import { canonicalMetadataWarnings, deliverMetadata } from './metadata.js'

const repositoryObject = { type: 'git', url: 'https://github.com/a/b' }
const agentPluginsSchema = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'

describe('deliverMetadata', () => {
	it.each(['claude-code', 'cursor', 'codex'] as const)('writes an object repository as its url for %s', (vendor) => {
		const result = deliverMetadata({ name: 'x', repository: repositoryObject }, vendor)
		expect(result.metadata['repository']).toBe('https://github.com/a/b')
		expect(result.conversions).toEqual(['repository: the { type, url } object is written as its url string'])
		expect(result.warnings).toEqual([])
	})

	it('leaves a string repository alone', () => {
		const result = deliverMetadata({ name: 'x', repository: 'https://github.com/a/b' }, 'claude-code')
		expect(result.metadata['repository']).toBe('https://github.com/a/b')
		expect(result.conversions).toEqual([])
	})

	it('leaves the canonical metadata it was given unchanged', () => {
		const metadata = { name: 'x', repository: repositoryObject }
		deliverMetadata(metadata, 'cursor')
		expect(metadata.repository).toBe(repositoryObject)
	})

	it('drops a repository object with no url and warns, naming the field and the vendor', () => {
		const result = deliverMetadata({ name: 'x', repository: { type: 'git' } }, 'claude-code')
		expect(result.metadata).not.toHaveProperty('repository')
		expect(result.warnings).toEqual([expect.stringMatching(/^claude-code accepts repository only as a URL string/)])
	})

	it.each(['claude-code', 'cursor'] as const)('drops an author without a name for %s and warns', (vendor) => {
		const result = deliverMetadata({ name: 'x', author: { email: 'a@b.c' } }, vendor)
		expect(result.metadata).not.toHaveProperty('author')
		expect(result.warnings).toEqual([
			`${vendor} rejects an author without a name — left out of the derived manifest; set author.name in plugin.json`,
		])
	})

	it('keeps an author without a name for codex, which accepts it', () => {
		const result = deliverMetadata({ name: 'x', author: { email: 'a@b.c' } }, 'codex')
		expect(result.metadata['author']).toEqual({ email: 'a@b.c' })
		expect(result.warnings).toEqual([])
	})

	it('keeps a named author and keywords as authored', () => {
		const metadata = { name: 'x', author: { name: 'A', email: 'a@b.c', url: 'https://a.b' }, keywords: ['k'] }
		const result = deliverMetadata(metadata, 'claude-code')
		expect(result.metadata).toEqual(metadata)
		expect(result.warnings).toEqual([])
	})

	it('leaves a field set under harnesses.<vendor> to the override', () => {
		const result = deliverMetadata(
			{ name: 'x', repository: repositoryObject, author: {} },
			'claude-code',
			new Set(['repository', 'author']),
		)
		expect(result.metadata['repository']).toBe(repositoryObject)
		expect(result.conversions).toEqual([])
		expect(result.warnings).toEqual([])
	})
})

describe('canonicalMetadataWarnings', () => {
	it('warns when codex reads a canonical manifest with an object repository', () => {
		const warnings = canonicalMetadataWarnings(
			{ $schema: agentPluginsSchema, name: 'x', repository: repositoryObject },
			['claude-code', 'codex'],
		)
		expect(warnings).toEqual([
			'codex reads the canonical plugin.json and rejects repository as an object, so it will not load this plugin — write repository as the URL string in plugin.json',
		])
	})

	it('says nothing when codex is not targeted', () => {
		expect(
			canonicalMetadataWarnings({ $schema: agentPluginsSchema, name: 'x', repository: repositoryObject }, [
				'claude-code',
				'copilot-cli',
			]),
		).toEqual([])
	})

	it('says nothing without an Agent Plugins $schema — codex then reads only .codex-plugin/plugin.json', () => {
		expect(canonicalMetadataWarnings({ name: 'x', repository: repositoryObject }, ['codex'])).toEqual([])
	})

	it('says nothing for a string repository', () => {
		expect(
			canonicalMetadataWarnings({ $schema: agentPluginsSchema, name: 'x', repository: 'https://github.com/a/b' }, [
				'codex',
			]),
		).toEqual([])
	})
})
