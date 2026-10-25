#!/usr/bin/env node
// Compiled by `universal-plugin plugin build` from src/skill-scripts/rewrite-upx.ts. Edit the source, not this file.
globalThis.__SKILL_SCRIPT__ = {"package":"universal-plugin","bin":"universal-plugin","version":"0.16.2","entry":"skills/adopt-upx/scripts/rewrite-upx.mjs","commands":{"marketplace add":"skills/marketplace/scripts/add.mjs","marketplace init":"skills/marketplace/scripts/marketplace.mjs","marketplace update":"skills/marketplace/scripts/update.mjs","marketplace validate":"skills/marketplace/scripts/validate.mjs","plugin build":"skills/build-plugin/scripts/build.mjs","plugin init":"skills/init-universal-plugin/scripts/init.mjs","plugin version":"skills/version/scripts/version.mjs"}};
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
//#region src/skill-scripts/rewrite-upx.ts
const SKIP_DIRS = /* @__PURE__ */ new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".turbo"
]);
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;
const PIN_EXEMPT_PATTERN = /(^|\n)\s*pin-exempt:\s*true\s*(\n|$)/;
const NPX_REF_PATTERN = /\bnpx(\s+(?:--yes\s+|-y\s+)?)([@a-z0-9/._-]+)@([^\s`'")]+)/g;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function isPinExempt(content) {
	const match = FRONTMATTER_PATTERN.exec(content);
	if (!match) return false;
	return PIN_EXEMPT_PATTERN.test(match[1]);
}
function caretRange(version) {
	const [major, minor] = version.split(".");
	return major === "0" ? `^0.${minor}` : `^${major}`;
}
function rewriteContent(content) {
	let changed = 0;
	return {
		next: content.replace(NPX_REF_PATTERN, (whole, ws, pkg, version) => {
			if (!SEMVER_PATTERN.test(version)) return whole;
			changed++;
			return `upx${ws}${pkg}@${caretRange(version)}`;
		}),
		changed
	};
}
function findSkillFiles(root) {
	const out = [];
	const st = statSync(root, { throwIfNoEntry: false });
	if (!st) return out;
	if (st.isFile()) {
		if (root.endsWith("SKILL.md")) out.push(root);
		return out;
	}
	if (st.isDirectory()) {
		const direct = join(root, "SKILL.md");
		if (statSync(direct, { throwIfNoEntry: false })?.isFile()) {
			out.push(direct);
			return out;
		}
		for (const entry of readdirSync(root, { withFileTypes: true })) if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			out.push(...findSkillFiles(join(root, entry.name)));
		}
	}
	return out;
}
function expandGlob(pattern) {
	if (!pattern.includes("*")) return null;
	const segments = pattern.split("/");
	let bases = ["."];
	for (const seg of segments) {
		if (!seg.includes("*")) {
			bases = bases.map((b) => join(b, seg));
			continue;
		}
		const re = new RegExp("^" + seg.split("*").map(escapeRegExp).join(".*") + "$");
		const next = [];
		for (const b of bases) {
			if (!statSync(b, { throwIfNoEntry: false })?.isDirectory()) continue;
			for (const entry of readdirSync(b)) if (re.test(entry)) next.push(join(b, entry));
		}
		bases = next;
	}
	return bases;
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function resolveTargets(args) {
	const all = args.includes("--all");
	const dryRun = args.includes("--dry-run");
	const positional = args.filter((a) => a !== "--all" && a !== "--dry-run");
	if (all) return {
		files: findSkillFiles("."),
		dryRun
	};
	const files = [];
	for (const arg of positional) {
		const globbed = expandGlob(arg);
		if (globbed) for (const g of globbed) files.push(...findSkillFiles(g));
		else files.push(...findSkillFiles(arg));
	}
	return {
		files: [...new Set(files)],
		dryRun
	};
}
function main() {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("usage: rewrite-upx.mjs (--all | <path-or-glob>...) [--dry-run]");
		process.exit(1);
	}
	const { files, dryRun } = resolveTargets(args);
	if (files.length === 0) {
		console.error("no SKILL.md files matched — nothing to do");
		process.exit(0);
	}
	let touched = 0;
	let skippedExempt = 0;
	for (const file of files) {
		const abs = resolve(file);
		const content = readFileSync(abs, "utf8");
		if (isPinExempt(content)) {
			skippedExempt++;
			console.log(`skip (pin-exempt): ${file}`);
			continue;
		}
		const { next, changed } = rewriteContent(content);
		if (changed === 0) continue;
		touched++;
		console.log(`${dryRun ? "[dry-run] " : ""}rewrite (${changed}): ${file}`);
		if (!dryRun) writeFileSync(abs, next, "utf8");
	}
	console.log(`\n${touched} file(s) rewritten, ${skippedExempt} skipped (pin-exempt), ${files.length} scanned.`);
}
main();
//#endregion
export {};
