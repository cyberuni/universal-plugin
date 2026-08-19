/** Holds this project's catalog rules against the runtime's own schema. `validation.ts` is a
 *  hand-written check — it names the key and the value to write instead, which a generic schema error
 *  does not — so the risk is that it drifts from what Claude Code actually loads. This test runs both
 *  over the same fixtures and requires them to agree on accept/reject. The schema is the vendored
 *  copy in `schema/`; see that directory's README for where it came from and when to re-fetch. */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Ajv } from 'ajv'
import { expect, test } from 'vitest'

import { validateCatalog } from './validation.js'

const officialSchema = JSON.parse(
	fs.readFileSync(
		path.join(path.dirname(fileURLToPath(import.meta.url)), '../../schema/claude-code-marketplace.json'),
		'utf8',
	),
) as Record<string, unknown>
delete officialSchema.$schema

const ajv = new Ajv({ strict: false, allErrors: true })
const validateOfficial = ajv.compile(officialSchema)

const base = {
	name: 'repobuddy',
	owner: { name: 'Ari Vance' },
	plugins: [{ name: 'repobuddy', source: './packages/buddy' }],
}

function entry(fields: Record<string, unknown>) {
	return { ...base, plugins: [{ ...base.plugins[0], ...fields }] }
}

const fixtures: [string, unknown][] = [
	['a minimal catalog', base],
	['a full entry', entry({ version: '1.3.2', description: 'd', homepage: 'https://x.dev', license: 'MIT' })],
	['string metadata', entry({ repository: 'https://github.com/repobuddy/repobuddy.git', keywords: ['cli'] })],
	['an author object', entry({ author: { name: 'Ari Vance', email: 'ari@example.com' } })],
	['a github source', entry({ source: { source: 'github', repo: 'repobuddy/repobuddy' } })],
	['an npm source', entry({ source: { source: 'npm', package: 'repobuddy' } })],
	['a marketplace description', { ...base, description: 'Local marketplace' }],
	['an owner as a string', { ...base, owner: 'Ari Vance' }],
	['a repository as an npm object', entry({ repository: { type: 'git', url: 'https://github.com/r/r.git' } })],
	['an author as a string', entry({ author: 'unional' })],
	['keywords as a string', entry({ keywords: 'cli' })],
	['a version as a number', entry({ version: 1 })],
	['no owner', { name: 'repobuddy', plugins: base.plugins }],
	['no name', { owner: base.owner, plugins: base.plugins }],
	['no plugins', { name: 'repobuddy', owner: base.owner }],
	['an entry without a source', { ...base, plugins: [{ name: 'repobuddy' }] }],
	['an entry without a name', { ...base, plugins: [{ source: './packages/buddy' }] }],
	['a source missing its "./" prefix', entry({ source: 'packages/buddy' })],
	['a github source without a repo', entry({ source: { source: 'github' } })],
	['plugins as an object', { ...base, plugins: {} }],
	['a catalog that is an array', ['nope']],
]

test.each(fixtures)('agrees with the official schema on %s', (_label, catalog) => {
	const acceptedByProject = validateCatalog('claude', catalog).length === 0
	expect(acceptedByProject).toBe(validateOfficial(catalog))
})
