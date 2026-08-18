#!/usr/bin/env node
// Derives README install instructions from the marketplace catalogs a repository already carries.
// Every command emitted here is traceable to vendor documentation; see
// .research/local-marketplaces/evidence.md. Do not add a command without an evidence row.
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const argv = process.argv.slice(2)
const rootFlag = argv.indexOf('--root')
const root = path.resolve(rootFlag === -1 ? process.cwd() : (argv[rootFlag + 1] ?? process.cwd()))
const slugFlag = argv.indexOf('--repo')

const readJson = (file) => {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch {
		return null
	}
}

/** owner/repo, from the flag, the manifest's repository field, or the git remote. */
function resolveSlug() {
	if (slugFlag !== -1 && argv[slugFlag + 1]) return argv[slugFlag + 1]
	const manifest = readJson(path.join(root, 'plugin.json'))
	const repo = typeof manifest?.repository === 'string' ? manifest.repository : manifest?.repository?.url
	const fromManifest = repo?.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1]
	if (fromManifest) return fromManifest
	try {
		const remote = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		return remote.match(/github\.com[/:]([^/]+\/[^/.\s]+)/)?.[1] ?? null
	} catch {
		return null
	}
}

const slug = resolveSlug()
const repoRef = slug ?? '<owner>/<repo>'

const claude = readJson(path.join(root, '.claude-plugin/marketplace.json'))
const copilot = readJson(path.join(root, '.github/plugin/marketplace.json'))
const codexDir = path.join(root, '.agents/plugins')
const codex = fs.existsSync(codexDir) && fs.readdirSync(codexDir).some((f) => f.endsWith('.json'))
const cursor = fs.existsSync(path.join(root, '.cursor-plugin/marketplace-submission.json'))

const targets = []
const sections = []

const pluginNames = (catalog) => (catalog?.plugins ?? []).map((p) => p.name).filter(Boolean)

if (claude) {
	const names = pluginNames(claude)
	const installs = (names.length > 0 ? names : ['<plugin>']).map((n) => `/plugin install ${n}@${claude.name}`)
	targets.push('claude-code')
	sections.push(['**Claude Code**', '', '```', `/plugin marketplace add ${repoRef}`, ...installs, '```'].join('\n'))
}

if (copilot) {
	const names = pluginNames(copilot)
	const installs = (names.length > 0 ? names : ['<plugin>']).map((n) => `copilot plugin install ${n}@${copilot.name}`)
	targets.push('copilot-cli')
	sections.push(
		['**GitHub Copilot CLI**', '', '```', `copilot plugin marketplace add ${repoRef}`, ...installs, '```'].join('\n'),
	)
}

if (codex) {
	targets.push('codex')
	sections.push(
		[
			'**Codex**',
			'',
			'Codex installs from its in-CLI browser. Run `/plugins`, add this repository as a marketplace,',
			'then start a new session before using the plugin.',
		].join('\n'),
	)
}

if (cursor) {
	targets.push('cursor')
	sections.push(
		[
			'**Cursor**',
			'',
			'Cursor installs from its own reviewed marketplace rather than from a repository, so this',
			'repository carries a submission scaffold instead of a catalog. To try the plugin before it is',
			'listed, symlink it into `~/.cursor/plugins/local/`, then reload the window.',
		].join('\n'),
	)
}

const markdown = sections.length === 0 ? '' : ['## Install', '', sections.join('\n\n'), ''].join('\n')

process.stdout.write(
	`${JSON.stringify({
		root,
		repo: slug,
		repoResolved: slug !== null,
		targets,
		markdown,
	})}\n`,
)
