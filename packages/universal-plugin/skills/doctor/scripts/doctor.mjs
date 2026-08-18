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
if (ext?.packagePath) {
	const pkgPath = path.join(root, ext.packagePath, 'package.json')
	const pkg = readJson(pkgPath)
	if (pkg === null) {
		add(
			'package-path-missing',
			'medium',
			`packagePath names ${ext.packagePath}, which holds no readable package.json`,
			'fix packagePath, or create the package',
		)
	} else if (manifest.version !== undefined && pkg.version !== manifest.version) {
		add(
			'version-drift',
			'high',
			`plugin.json is ${manifest.version}, ${ext.packagePath}/package.json is ${pkg.version}`,
			'/universal-plugin:version',
		)
	}
}

report({ vendors })

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
