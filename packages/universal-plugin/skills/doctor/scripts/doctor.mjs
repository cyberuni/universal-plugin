#!/usr/bin/env node
// Read-only diagnosis of a universal plugin. Emits one JSON object on stdout; never writes.
// Derivation itself is not re-implemented here — the shipped CLI's own build resolver is the source
// of truth for what each vendor gets, and this script only adds the filesystem facts it cannot see.
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const UP_NAMESPACE = 'org.cyberuni.universal-plugin'
// <package>/skills/<skill>/scripts/doctor.mjs: four levels up is the package root.
const packageRoot = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))))

const argv = process.argv.slice(2)
const verbose = argv.includes('--verbose')
const rootFlag = argv.indexOf('--root')
const root = path.resolve(rootFlag === -1 ? process.cwd() : (argv[rootFlag + 1] ?? process.cwd()))

const findings = []
const add = (code, severity, detail, repair) => findings.push({ code, severity, detail, repair })

const readJson = (file) => {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch {
		return null
	}
}
const mtime = (file) => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : null)

const VENDOR_MANIFESTS = ['.claude-plugin/plugin.json', '.cursor-plugin/plugin.json', '.codex-plugin/plugin.json']

const manifestPath = path.join(root, 'plugin.json')
const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null

if (manifest === null) {
	const orphans = VENDOR_MANIFESTS.filter((rel) => fs.existsSync(path.join(root, rel)))
	if (fs.existsSync(manifestPath)) {
		add('unparsable-manifest', 'critical', 'plugin.json is not valid JSON', 'fix the syntax error')
	} else if (orphans.length > 0) {
		add(
			'vendor-only',
			'high',
			`vendor manifests with no canonical manifest: ${orphans.join(', ')}`,
			'/universal-plugin:init, adopt route',
		)
	} else {
		add('no-manifest', 'high', 'no root plugin.json — this is not a plugin yet', '/universal-plugin:init')
	}
	report({ vendors: [] })
}

const ext = manifest.extensions?.[UP_NAMESPACE] ?? null

// `packagePath` is the CLI's own config, and the CLI reads it from `.agents/universal-plugin.json`
// (src/version/fs.ts). It is read here from the same file, so a plugin the CLI treats as npm-shipping
// is one this script treats the same way. The manifest extension is accepted as a fallback for a
// repository that put it there.
const packagePath = readPackagePath()
if (!manifest.$schema?.includes('agent-plugins.org') || ext === null) {
	add(
		'legacy-manifest',
		'high',
		'root plugin.json carries no $schema on agent-plugins.org or no extensions block',
		'/universal-plugin:init, adopt route',
	)
}

// Shadowing and leftovers. `.plugin/plugin.json` outranks root in Copilot CLI's search order.
if (fs.existsSync(path.join(root, '.plugin/plugin.json'))) {
	add(
		'shadowing-manifest',
		'high',
		'.plugin/plugin.json outranks root and is read instead of the canonical manifest',
		'/universal-plugin:remove-plugin',
	)
}
if (fs.existsSync(path.join(root, '.github/plugin/plugin.json'))) {
	add(
		'stale-github-plugin',
		'low',
		'.github/plugin/plugin.json is a leftover from an older build and is no longer generated',
		'/universal-plugin:remove-plugin',
	)
}

// Ask the shipped CLI what it would write, without writing it.
const bin = path.join(packageRoot, 'bin', 'universal-plugin.mjs')
const cli = fs.existsSync(bin)
	? spawnSync(process.execPath, [bin, 'plugin', 'build', '--dry-run', '--format', 'json', '--root', root], {
			encoding: 'utf8',
		})
	: spawnSync('npx', ['universal-plugin', 'plugin', 'build', '--dry-run', '--format', 'json', '--root', root], {
			encoding: 'utf8',
		})

const vendors = []
const build = readJson_stdout(cli.stdout)

if (build === null) {
	const stderr = (cli.stderr ?? '').trim()
	if (/required when targeting codex/.test(stderr)) {
		add(
			'codex-fields-missing',
			'high',
			'codex is targeted without version or description — the build writes nothing at all, for any vendor',
			'add both to the canonical top level',
		)
	} else {
		add(
			'build-failed',
			'high',
			stderr.split('\n')[0] || 'plugin build could not resolve the manifest',
			'run plugin build to see the full error',
		)
	}
} else {
	const manifestMtime = mtime(manifestPath)
	for (const row of [...build.built, ...build.canonical, ...build.skipped, ...build.failed]) {
		const abs = path.join(root, row.path)
		const exists = fs.existsSync(abs)
		// `canonical` means the vendor reads root plugin.json; no derived file is expected.
		const stale = row.status === 'built' && exists && manifestMtime !== null && mtime(abs) < manifestMtime
		vendors.push({ vendor: row.vendor, path: row.path, status: row.status, exists, stale })

		if (row.status === 'built' && !exists) {
			add(
				'unbuilt',
				'high',
				`${row.vendor} is declared but ${row.path} does not exist — that runtime sees no plugin`,
				'universal-plugin plugin build',
			)
		}
		if (stale) {
			add('stale', 'medium', `${row.path} is older than plugin.json`, 'universal-plugin plugin build')
		}
	}
	for (const warning of build.warnings ?? []) {
		if (/not delivered/.test(warning)) {
			add('undeliverable-override', 'medium', warning, '/universal-plugin:init, update route')
		} else if (/No vendors declared/.test(warning)) {
			add(
				'no-vendors',
				'medium',
				'no vendor is declared — the build writes nothing, so no runtime reads this plugin',
				'/universal-plugin:init, update route',
			)
		} else if (/^Unknown vendor/.test(warning)) {
			add('unknown-vendor', 'medium', warning, 'fix the vendor id in plugin.json')
		} else {
			add('build-warning', 'low', warning, 'read the warning and decide')
		}
	}
}

// Version drift between the two authored numbers.
if (packagePath !== null) {
	const pkgPath = path.join(root, packagePath, 'package.json')
	const pkg = readJson(pkgPath)
	if (pkg === null) {
		add(
			'package-path-missing',
			'medium',
			`packagePath names ${packagePath}, which holds no readable package.json`,
			'fix packagePath, or create the package',
		)
	} else if (manifest.version !== undefined && pkg.version !== manifest.version) {
		add(
			'version-drift',
			'high',
			`plugin.json is ${manifest.version}, ${packagePath}/package.json is ${pkg.version}`,
			'/universal-plugin:version',
		)
	}
}

// Content shipped since the version last moved (ADR-0010 §6). A runtime keys its plugin cache on the
// version, so anything committed after the commit that set the current one is invisible to a consumer
// who already installed the plugin. Read-only: the comparison is git's, and it is skipped wherever
// git cannot answer.
//
// Not run where the release picks the number. ADR-0010 §2 makes `packagePath` the switch: a plugin
// that ships to npm gets its version from the release, so content sitting ahead of the last released
// one is the normal state there, not a defect. Only the author-picks model can forget the bump.
if (manifest.version !== undefined && packagePath === null) {
	const introduced = commitThatSetVersion(manifest.version)
	if (introduced !== null) {
		const changed = git('diff', '--name-only', `${introduced}..HEAD`, '--', ...shippedPaths())
		const files = (changed ?? '').split('\n').filter(Boolean)
		if (files.length > 0) {
			const sample = files.slice(0, 3).join(', ')
			add(
				'unreleased-content',
				'medium',
				`${files.length} shipped file(s) changed since ${manifest.version} was set (${sample}${files.length > 3 ? ', …' : ''}) — a consumer keyed on that version never re-extracts them`,
				'/universal-plugin:version',
			)
		}
	}
}

// The marketplace catalogs a user installs from. They sit at the *repository* root, above a plugin in
// a monorepo, and each is read by its runtime at install time — a catalog whose shape that runtime
// refuses fails in the user's terminal, not here. The shipped CLI owns the rules; this only asks.
for (const row of invalidCatalogs()) {
	add(
		'invalid-catalog',
		'high',
		`${row.path} is not a shape its runtime loads: ${row.issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`,
		'/universal-plugin:marketplace',
	)
}

report({ vendors })

/** Every catalog the repository carries that its runtime would refuse. Empty when there is nothing to
 *  read, when the CLI is too old to answer, or when every catalog is fine — a missing catalog is not a
 *  fault, and this reports no opinion on which ones a repository ought to carry. */
function invalidCatalogs() {
	const catalogRoot = git('rev-parse', '--show-toplevel') ?? root
	const result = fs.existsSync(bin)
		? spawnSync(process.execPath, [bin, 'marketplace', 'validate', '--format', 'json', '--root', catalogRoot], {
				encoding: 'utf8',
			})
		: spawnSync('npx', ['universal-plugin', 'marketplace', 'validate', '--format', 'json', '--root', catalogRoot], {
				encoding: 'utf8',
			})
	const rows = readJson_stdout(result.stdout)
	return Array.isArray(rows) ? rows.filter((row) => row.status === 'invalid') : []
}

/** Runs git inside `root`, returning its stdout or `null` — a non-zero status, a missing git, and a
 *  directory outside any repository are all the same answer here: no history to read. */
function git(...args) {
	const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
	return result.status === 0 ? result.stdout.trim() : null
}

/** The commit that introduced the version the manifest carries now, walking `plugin.json`'s history
 *  newest-first until the version changes. `null` when there is no history, or when the newest
 *  committed manifest already disagrees — that version is uncommitted, so nothing shipped under it. */
function commitThatSetVersion(current) {
	const log = git('log', '--format=%H', '-100', '--', 'plugin.json')
	if (log === null || log === '') return null

	let introduced = null
	for (const sha of log.split('\n').filter(Boolean)) {
		const blob = git('show', `${sha}:./plugin.json`)
		if (blob === null) break
		let version
		try {
			version = JSON.parse(blob).version
		} catch {
			break
		}
		if (version !== current) break
		introduced = sha
	}
	return introduced
}

/** What a consumer installs, as pathspecs. The derived vendor manifests are deliberately absent —
 *  they only ever change because the canonical manifest did, and counting both would report one
 *  change twice. */
function shippedPaths() {
	const skills = typeof ext?.skills === 'string' ? ext.skills : './skills/'
	const paths = ['plugin.json', skills, 'agents', 'governances', 'mcp.json']
	return paths.filter((rel) => fs.existsSync(path.join(root, rel)))
}

function readJson_stdout(stdout) {
	if (!stdout) return null
	try {
		return JSON.parse(stdout)
	} catch {
		return null
	}
}

function report({ vendors }) {
	const result = {
		root,
		manifest: manifest === null ? null : { name: manifest.name ?? null, version: manifest.version ?? null },
		vendors,
		findings,
		ok: findings.length === 0,
	}
	process.stdout.write(`${JSON.stringify(result)}\n`)
	if (verbose) {
		process.stderr.write(result.ok ? 'no findings\n' : `${findings.length} finding(s)\n`)
		for (const f of findings) process.stderr.write(`  [${f.severity}] ${f.code}: ${f.detail}\n`)
	}
	process.exit(0)
}

/** Where the npm package that ships this plugin lives, or `null` when the plugin ships to no
 *  package. `null` is the author-picks release model of ADR-0010 §2. */
function readPackagePath() {
	const declared = readJson(path.join(root, '.agents', 'universal-plugin.json'))?.packagePath ?? ext?.packagePath
	return typeof declared === 'string' && declared.length > 0 ? declared : null
}
