import { describe, expect, it } from 'vitest'

import { SCHEMA_URL, validateCanonicalManifest, vendorRuleViolations } from './validation.js'

const knownVendors = new Set(['claude-code', 'cursor', 'codex', 'copilot-cli'])

function up(config: Record<string, unknown>) {
	return { 'org.cyberuni.universal-plugin': config }
}

function validate(manifest: unknown, opts: { vendor?: string; strict?: boolean } = {}) {
	return validateCanonicalManifest(manifest, { knownVendors, ...opts })
}

describe('validateCanonicalManifest — schema', () => {
	it('passes a minimal canonical manifest', () => {
		expect(validate({ $schema: SCHEMA_URL, name: 'pods' })).toEqual({
			valid: true,
			schemaViolations: [],
			vendorViolations: [],
			warnings: [],
		})
	})

	it('reports every missing required field together', () => {
		const result = validate({})
		expect(result.valid).toBe(false)
		expect(result.schemaViolations).toEqual([
			{ field: '$schema', rule: 'required', message: 'required field missing' },
			{ field: 'name', rule: 'required', message: 'required field missing' },
		])
	})

	it('does not require version outside a codex target', () => {
		expect(validate({ $schema: SCHEMA_URL, name: 'pods' }).schemaViolations).toEqual([])
	})

	it('rejects a $schema that names another schema', () => {
		expect(validate({ $schema: 'https://example.com/x.json', name: 'pods' }).schemaViolations).toEqual([
			{ field: '$schema', rule: 'const', message: `must be "${SCHEMA_URL}"` },
		])
	})

	it.each(['Pods', 'a--b', 'a..b', '-a', 'a'.repeat(65)])('rejects the name %s', (name) => {
		const [violation] = validate({ $schema: SCHEMA_URL, name }).schemaViolations
		expect(violation?.field).toBe('name')
	})

	it('checks field types, author fields, keywords, and extension namespaces', () => {
		const result = validate({
			$schema: SCHEMA_URL,
			name: 'pods',
			version: 1,
			author: { name: 'pan', twitter: '@pan' },
			keywords: ['ok', 2],
			extensions: { 'com.example': 'nope' },
		})
		expect(result.schemaViolations.map((v) => `${v.field}:${v.rule}`)).toEqual([
			'version:type',
			'author.twitter:additionalProperties',
			'keywords[1]:type',
			'extensions.com.example:type',
		])
	})

	it('rejects unknown top-level fields such as the pre-0.6 vendorExtensions block', () => {
		const result = validate({ $schema: SCHEMA_URL, name: 'pods', vendorExtensions: {} })
		expect(result.schemaViolations).toEqual([
			expect.objectContaining({ field: 'vendorExtensions', rule: 'additionalProperties' }),
		])
	})

	it('reports a malformed dependencies declaration as a schema violation', () => {
		const result = validate({ $schema: SCHEMA_URL, name: 'pods', extensions: up({ dependencies: { a: '1' } }) })
		expect(result.schemaViolations).toEqual([
			expect.objectContaining({ field: 'extensions.org.cyberuni.universal-plugin.dependencies' }),
		])
	})

	it('reports a manifest that is not an object', () => {
		expect(validate([]).schemaViolations).toEqual([
			{ field: '', rule: 'type', message: 'plugin.json must be a JSON object' },
		])
	})
})

describe('validateCanonicalManifest — vendor rules', () => {
	const codexOnly = { $schema: SCHEMA_URL, name: 'pods', extensions: up({ harnesses: { codex: {}, cursor: {} } }) }

	it('requires description and version when targeting codex', () => {
		expect(validate(codexOnly).vendorViolations).toEqual([
			{ field: 'description', rule: 'codex', message: 'description is required when targeting codex' },
			{ field: 'version', rule: 'codex', message: 'version is required when targeting codex' },
		])
	})

	it('scopes vendor rules to --vendor', () => {
		expect(validate(codexOnly, { vendor: 'cursor' }).valid).toBe(true)
	})

	it('follows the explicit vendors list over harnesses keys', () => {
		const manifest = { ...codexOnly, extensions: up({ vendors: ['cursor'], harnesses: { codex: {}, cursor: {} } }) }
		expect(validate(manifest).vendorViolations).toEqual([])
	})

	it('warns on an unknown vendor key and stays valid', () => {
		const result = validate({ $schema: SCHEMA_URL, name: 'pods', extensions: up({ harnesses: { acme: {} } }) })
		expect(result.valid).toBe(true)
		expect(result.warnings).toEqual(['Unknown vendor "acme" in harnesses'])
	})

	it('promotes an unknown vendor key to a violation under strict', () => {
		const result = validate(
			{ $schema: SCHEMA_URL, name: 'pods', extensions: up({ harnesses: { acme: {} } }) },
			{ strict: true },
		)
		expect(result.valid).toBe(false)
		expect(result.vendorViolations).toEqual([
			{ field: 'harnesses.acme', rule: 'known-vendor', message: 'Unknown vendor "acme" in harnesses' },
		])
	})
})

describe('vendorRuleViolations', () => {
	it('ignores a codex block that is not a target', () => {
		expect(vendorRuleViolations({ name: 'pods' }, { codex: {} }, ['cursor'])).toEqual([])
	})
})
