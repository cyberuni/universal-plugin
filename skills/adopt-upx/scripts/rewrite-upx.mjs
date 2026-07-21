#!/usr/bin/env node
// Rewrites `npx <pkg>@<version>` references inside SKILL.md files to the fast local-first
// `upx <pkg>@^<major>` form. See ../SKILL.md for the full contract; this is the mechanism.
//
// Usage:
//   node rewrite-upx.mjs --all                    # every SKILL.md under cwd
//   node rewrite-upx.mjs skills/my-skill           # one skill (dir or SKILL.md path)
//   node rewrite-upx.mjs skills/a skills/b/SKILL.md skills/c-*   # a named set (paths + globs)
//   node rewrite-upx.mjs --all --dry-run           # report only, write nothing
//
// Rewrite rule: `npx <pkg>@<concrete-semver>` -> `upx <pkg>@^<major>` (caret on the major, so
// one global `upx` install serves many pinned callers). Left alone:
//   - `@<placeholder>` (non-semver, e.g. `@<version>`) — not a real pin
//   - dist-tags (e.g. `@next`, `@latest`) — upx can't range-match these, they go to npx anyway
//   - any occurrence already using `upx` — nothing to rewrite
//   - any SKILL.md whose frontmatter declares `pin-exempt: true` — its versions are illustration
//     (same convention `plugin bundle` uses; see packages/universal-plugin/.agents/spec/plugin/bundle/README.md)
//
// Idempotent: a second run finds no more `npx <pkg>@<semver>` occurrences to rewrite.

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo'])

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/
const PIN_EXEMPT_PATTERN = /(^|\n)\s*pin-exempt:\s*true\s*(\n|$)/

// Matches `npx <pkg>@<version>` — mirrors the pattern `plugin bundle` uses for pin rewriting,
// but only for the `npx` runner word (upx refs are already fast, nothing to do). The package
// class includes `@` and `/` so a scoped package (`@acme/cli@1.2.3`) matches; greedy matching
// backtracks to the LAST `@`, which separates the version.
const NPX_REF_PATTERN = /\bnpx(\s+(?:--yes\s+|-y\s+)?)([@a-z0-9/._-]+)@([^\s`'")]+)/g

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function isPinExempt(content) {
	const match = FRONTMATTER_PATTERN.exec(content)
	if (!match) return false
	return PIN_EXEMPT_PATTERN.test(match[1])
}

function rewriteContent(content) {
	let changed = 0
	const next = content.replace(NPX_REF_PATTERN, (whole, ws, pkg, version) => {
		if (!SEMVER_PATTERN.test(version)) return whole // placeholder or dist-tag — leave alone
		const major = version.split('.')[0]
		changed++
		return `upx${ws}${pkg}@^${major}`
	})
	return { next, changed }
}

function findSkillFiles(root) {
	const out = []
	const st = statSync(root, { throwIfNoEntry: false })
	if (!st) return out
	if (st.isFile()) {
		if (root.endsWith('SKILL.md')) out.push(root)
		return out
	}
	if (st.isDirectory()) {
		const direct = join(root, 'SKILL.md')
		if (statSync(direct, { throwIfNoEntry: false })?.isFile()) {
			out.push(direct)
			return out // a skill dir given directly — don't also recurse into it
		}
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (SKIP_DIRS.has(entry.name)) continue
				out.push(...findSkillFiles(join(root, entry.name)))
			}
		}
	}
	return out
}

// Minimal glob: only `*` within a single path segment (no `**`). Enough for named-set patterns
// like `skills/foo-*` or `skills/*/SKILL.md`.
function expandGlob(pattern) {
	if (!pattern.includes('*')) return null
	const segments = pattern.split('/')
	let bases = ['.']
	for (const seg of segments) {
		if (!seg.includes('*')) {
			bases = bases.map((b) => join(b, seg))
			continue
		}
		const re = new RegExp('^' + seg.split('*').map(escapeRegExp).join('.*') + '$')
		const next = []
		for (const b of bases) {
			const st = statSync(b, { throwIfNoEntry: false })
			if (!st?.isDirectory()) continue
			for (const entry of readdirSync(b)) {
				if (re.test(entry)) next.push(join(b, entry))
			}
		}
		bases = next
	}
	return bases
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveTargets(args) {
	const all = args.includes('--all')
	const dryRun = args.includes('--dry-run')
	const positional = args.filter((a) => a !== '--all' && a !== '--dry-run')

	if (all) return { files: findSkillFiles('.'), dryRun }

	const files = []
	for (const arg of positional) {
		const globbed = expandGlob(arg)
		if (globbed) {
			for (const g of globbed) files.push(...findSkillFiles(g))
		} else {
			files.push(...findSkillFiles(arg))
		}
	}
	return { files: [...new Set(files)], dryRun }
}

function main() {
	const args = process.argv.slice(2)
	if (args.length === 0) {
		console.error('usage: rewrite-upx.mjs (--all | <path-or-glob>...) [--dry-run]')
		process.exit(1)
	}

	const { files, dryRun } = resolveTargets(args)
	if (files.length === 0) {
		console.error('no SKILL.md files matched — nothing to do')
		process.exit(0)
	}

	let touched = 0
	let skippedExempt = 0
	for (const file of files) {
		const abs = resolve(file)
		const content = readFileSync(abs, 'utf8')
		if (isPinExempt(content)) {
			skippedExempt++
			console.log(`skip (pin-exempt): ${file}`)
			continue
		}
		const { next, changed } = rewriteContent(content)
		if (changed === 0) continue
		touched++
		console.log(`${dryRun ? '[dry-run] ' : ''}rewrite (${changed}): ${file}`)
		if (!dryRun) writeFileSync(abs, next, 'utf8')
	}

	console.log(`\n${touched} file(s) rewritten, ${skippedExempt} skipped (pin-exempt), ${files.length} scanned.`)
}

main()
