#!/usr/bin/env node
// Compiled by `universal-plugin plugin build` from src/skill-scripts/doctor.ts. Edit the source, not this file.
globalThis.__SKILL_SCRIPT__ = {"package":"universal-plugin","bin":"universal-plugin","version":"0.16.0","entry":"skills/doctor-universal-plugin/scripts/doctor.mjs","commands":{"marketplace add":"skills/marketplace/scripts/add.mjs","marketplace init":"skills/marketplace/scripts/marketplace.mjs","marketplace validate":"skills/marketplace/scripts/validate.mjs","plugin build":"skills/build-plugin/scripts/build.mjs","plugin init":"skills/init-universal-plugin/scripts/init.mjs","plugin version":"skills/version/scripts/version.mjs"}};
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
//#region src/compile/scripts.ts
/** The global the header assigns the script data to. Framework-neutral: a script's own code, or the
*  library it inlines, reads it; universal-plugin depends on neither. */
const SCRIPT_GLOBAL = "__SKILL_SCRIPT__";
//#endregion
//#region src/skill-scripts/cli-runner.ts
/** The data `plugin build` embedded in this compiled script. */
function skillScript() {
	const data = globalThis[SCRIPT_GLOBAL];
	if (data === void 0) throw new Error("this script runs only as compiled by `plugin build`");
	return data;
}
/** Runs the universal-plugin CLI. A skill may be copied away from its package, so it never reaches
*  for a CLI beside it: the project's installed CLI first, then the one pinned to this script's
*  version, which `plugin version` stamps. */
function runCli$1(args, options = {}) {
	const { bin, package: pkg, version } = skillScript();
	const name = bin ?? "universal-plugin";
	if (spawnSync("pnpm", [
		"exec",
		name,
		"--version"
	], { encoding: "utf8" }).status === 0) return spawnSync("pnpm", [
		"exec",
		name,
		...args
	], {
		encoding: "utf8",
		...options
	});
	const pinned = `${pkg ?? "universal-plugin"}@${version ?? "latest"}`;
	return spawnSync("npx", [pinned, ...args], {
		encoding: "utf8",
		...options
	});
}
//#endregion
//#region src/skill-scripts/doctor.ts
const UP_NAMESPACE = "org.cyberuni.universal-plugin";
const argv = process.argv.slice(2);
const verbose = argv.includes("--verbose");
const rootFlag = argv.indexOf("--root");
const root = path.resolve(rootFlag === -1 ? process.cwd() : argv[rootFlag + 1] ?? process.cwd());
const marketplaceRoots = argv.flatMap((arg, i) => arg === "--marketplace-root" ? [argv[i + 1]] : []).filter(Boolean);
const findings = [];
/** semantic-release's version placeholder until its publish run stamps the real number. */
const UNSTAMPED_VERSION = "0.0.0-development";
const add = (code, severity, detail, repair) => findings.push({
	code,
	severity,
	detail,
	repair
});
const readJson = (file) => {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
};
const mtime = (file) => fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
const contentMtime = (abs) => {
	const stat = fs.statSync(abs);
	if (!stat.isDirectory()) return stat.mtimeMs;
	const files = fs.readdirSync(abs).map((entry) => contentMtime(path.join(abs, entry)));
	return files.length === 0 ? stat.mtimeMs : Math.max(...files);
};
const VENDOR_MANIFESTS = [
	".claude-plugin/plugin.json",
	".cursor-plugin/plugin.json",
	".codex-plugin/plugin.json"
];
const manifestPath = path.join(root, "plugin.json");
const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
if (manifest === null) {
	const orphans = VENDOR_MANIFESTS.filter((rel) => fs.existsSync(path.join(root, rel)));
	if (fs.existsSync(manifestPath)) add("unparsable-manifest", "critical", "plugin.json is not valid JSON", "fix the syntax error");
	else if (orphans.length > 0) add("vendor-only", "high", `vendor manifests with no canonical manifest: ${orphans.join(", ")}`, "/universal-plugin:init-universal-plugin, adopt route");
	else add("no-manifest", "high", "no root plugin.json — this is not a plugin yet", "/universal-plugin:init-universal-plugin");
	report({ vendors: [] });
}
/** The canonical $schema is hosted on agent-plugins.org; a URL that merely mentions the name is not. */
function isAgentPluginsSchema(schema) {
	if (typeof schema !== "string") return false;
	try {
		return new URL(schema).hostname === "agent-plugins.org";
	} catch {
		return false;
	}
}
const ext = manifest.extensions?.[UP_NAMESPACE] ?? null;
const runCli = (...args) => runCli$1(args);
const packagePath = readPackagePath();
if (packagePath === void 0) add("package-path-unknown", "low", "the CLI could not report packagePath, so version-drift and unreleased-content were not checked", "upgrade universal-plugin");
if (ext !== null && Object.hasOwn(ext, "packagePath")) add("misplaced-package-path", "high", `plugin.json declares extensions["${UP_NAMESPACE}"].packagePath, which the CLI never reads${packagePath === null ? " — this plugin is treated as not shipping to npm" : ""}`, "move packagePath to .agents/universal-plugin.json, relative to the plugin root");
if (!isAgentPluginsSchema(manifest.$schema) || ext === null) add("legacy-manifest", "high", "root plugin.json carries no $schema on agent-plugins.org or no extensions block", "/universal-plugin:init-universal-plugin, adopt route");
if (fs.existsSync(path.join(root, ".plugin/plugin.json"))) add("shadowing-manifest", "high", ".plugin/plugin.json outranks root and is read instead of the canonical manifest", "/universal-plugin:remove-plugin");
if (fs.existsSync(path.join(root, ".github/plugin/plugin.json"))) add("stale-github-plugin", "low", ".github/plugin/plugin.json is a leftover from an older build and is no longer generated", "/universal-plugin:remove-plugin");
const COPILOT_NAMESPACE = "com.github.copilot";
if ((ext?.vendors ?? Object.keys(ext?.harnesses ?? {})).includes("copilot-cli")) {
	const nsDir = path.join(root, COPILOT_NAMESPACE);
	const declaredPaths = (value, fallback) => {
		if (value === void 0) return fallback === null ? [] : [fallback];
		if (typeof value === "string") return [value];
		if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string");
		if (value && Array.isArray(value.paths)) return value.paths.filter((entry) => typeof entry === "string");
		return [];
	};
	const hasContent = (rel) => {
		const abs = path.join(root, rel);
		return fs.existsSync(abs) && fs.statSync(abs).isDirectory() && fs.readdirSync(abs).length > 0;
	};
	const missing = [];
	for (const [kind, defaultPath] of [
		["agents", "./agents/"],
		["commands", "./commands/"],
		["rules", "./rules/"]
	]) if (declaredPaths(ext?.[kind], defaultPath).some(hasContent) && !hasContent(path.join(COPILOT_NAMESPACE, kind))) missing.push(kind);
	const inlineHooks = ext?.hooks !== null && typeof ext?.hooks === "object" && "hooks" in ext.hooks;
	const hookSources = inlineHooks ? [] : declaredPaths(ext?.hooks, "./hooks/hooks.json");
	if ((inlineHooks || hookSources.some((rel) => fs.existsSync(path.join(root, rel)))) && !fs.existsSync(path.join(nsDir, "hooks", "hooks.json"))) missing.push("hooks");
	if (declaredPaths(ext?.lspServers, null).some((rel) => fs.existsSync(path.join(root, rel))) && !fs.existsSync(path.join(nsDir, "lsp.json"))) missing.push("lspServers");
	if (missing.length > 0) add("copilot-root-components", "high", `${missing.join(", ")} sit at the plugin root with no copy under ${COPILOT_NAMESPACE}/ — Copilot CLI reads them only from there once the canonical $schema is declared, so it loads none of them`, "universal-plugin plugin build");
}
const cli = runCli("plugin", "build", "--dry-run", "--format", "json", "--root", root);
const vendors = [];
const build = readJson_stdout(cli.stdout);
if (build === null) {
	const stderr = (cli.stderr ?? "").trim();
	if (/required when targeting codex/.test(stderr)) add("codex-fields-missing", "high", "codex is targeted without version or description — the build writes nothing at all, for any vendor", "add both to the canonical top level");
	else if (findings.some((f) => f.code === "legacy-manifest" || f.code === "shadowing-manifest")) add("no-vendors", "medium", "no vendor is declared — the project is on the pre-0.6 layout, so the build derives nothing and no runtime reads this plugin", "/universal-plugin:init-universal-plugin, adopt route");
	else add("build-failed", "high", stderr.split("\n")[0] || "plugin build could not resolve the manifest", "run plugin build to see the full error");
} else {
	const manifestMtime = mtime(manifestPath);
	for (const row of [
		...build.built,
		...build.canonical,
		...build.skipped,
		...build.failed
	]) {
		const abs = path.join(root, row.path);
		const exists = fs.existsSync(abs);
		const stale = row.status === "built" && exists && manifestMtime !== null && contentMtime(abs) < manifestMtime;
		vendors.push({
			vendor: row.vendor,
			path: row.path,
			status: row.status,
			exists,
			stale
		});
		if (row.status === "built" && !exists) add("unbuilt", "high", `${row.vendor} is declared but ${row.path} does not exist — that runtime sees no plugin`, "universal-plugin plugin build");
		if (stale) add("stale", "medium", `${row.path} is older than plugin.json`, "universal-plugin plugin build");
	}
	for (const row of build.scripts ?? []) {
		if (row.status !== "stale" && row.status !== "missing") continue;
		add("stale-script", "medium", row.status === "missing" ? `${row.path} is declared but not compiled from ${row.source}` : `${row.path} is behind its source ${row.source}`, "universal-plugin plugin build, then commit the compiled script");
	}
	for (const warning of build.warnings ?? []) if (/^Failed to compile /.test(warning)) add("script-compile-failed", "high", warning, "fix the entry so every import resolves, then plugin build");
	else if (/budget for a compiled skill script/.test(warning)) add("script-over-budget", "low", warning, "have the skill call the installed CLI instead of compiling it in");
	else if (/not delivered/.test(warning)) add("undeliverable-override", "medium", warning, "/universal-plugin:init-universal-plugin, update route");
	else if (/No vendors declared/.test(warning)) add("no-vendors", "medium", "no vendor is declared — the build writes nothing, so no runtime reads this plugin", "/universal-plugin:init-universal-plugin, update route");
	else if (/has no "[^"]+" component/.test(warning)) add("unsupported-component", "low", warning, "declare the path under harnesses.<vendor> for the vendors that read it, or leave it — the build already drops it");
	else if (/outside the skill folder/.test(warning)) add("skill-link-escapes", "medium", warning, "copy the linked file into the skill and link it relatively, or link it by URL");
	else if (/^Unknown vendor/.test(warning)) add("unknown-vendor", "medium", warning, "fix the vendor id in plugin.json");
	else add("build-warning", "low", warning, "read the warning and decide");
}
let packageMissing = false;
if (typeof packagePath === "string") {
	if (readJson(path.join(root, packagePath, "package.json")) === null) {
		packageMissing = true;
		add("package-path-missing", "medium", `packagePath names ${packagePath}, which holds no readable package.json`, "fix packagePath, or create the package");
	}
}
if (packagePath !== void 0 && !packageMissing) {
	const check = readJson_stdout(runCli("publish", "check-version", "--format", "json", "--root", root).stdout);
	if (check !== null && Array.isArray(check.drifted)) {
		for (const file of check.drifted) add("version-drift", "high", `${file.path} is ${file.version ?? "(no version)"}, ${check.source} is ${check.expected}`, "/universal-plugin:version");
		for (const file of check.unstamped ?? []) add("unstamped", "low", `${file.path} holds ${UNSTAMPED_VERSION}, which the release replaces`, "semantic-release: run `plugin version ${nextRelease.version}` in prepareCmd and commit the stamped files back");
	} else if (typeof packagePath === "string") {
		const pkg = readJson(path.join(root, packagePath, "package.json"));
		if (manifest.version !== void 0 && pkg.version !== UNSTAMPED_VERSION && pkg.version !== manifest.version) add("version-drift", "high", `plugin.json is ${manifest.version}, ${packagePath}/package.json is ${pkg.version}`, "/universal-plugin:version");
	}
}
if (manifest.version !== void 0 && packagePath === null) {
	const introduced = commitThatSetVersion(manifest.version);
	if (introduced !== null) {
		const files = (git("diff", "--name-only", `${introduced}..HEAD`, "--", ...shippedPaths()) ?? "").split("\n").filter(Boolean);
		if (files.length > 0) {
			const sample = files.slice(0, 3).join(", ");
			add("unreleased-content", "medium", `${files.length} shipped file(s) changed since ${manifest.version} was set (${sample}${files.length > 3 ? ", …" : ""}) — a consumer keyed on that version never re-extracts them`, "/universal-plugin:version");
		}
	}
}
const missingMarketplaceRoots = marketplaceRoots.filter((r) => !fs.existsSync(path.resolve(r)));
for (const r of missingMarketplaceRoots) add("marketplace-root-missing", "high", `--marketplace-root ${r} does not exist`, "clone the marketplace repository, or fix the path");
const existingMarketplaceRoots = marketplaceRoots.filter((r) => fs.existsSync(path.resolve(r)));
for (const row of invalidCatalogs(existingMarketplaceRoots)) add("invalid-catalog", "high", `${row.own ? row.path : `${row.catalogRoot}/${row.path}`} is not a shape its runtime loads: ${row.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`, "/universal-plugin:marketplace");
report({ vendors });
/** Every catalog the repository — and any explicitly named marketplace clone — carries that its
*  runtime would refuse. Empty when there is nothing to read, when the CLI is too old to answer, or
*  when every catalog is fine — a missing catalog is not a fault, and this reports no opinion on
*  which ones a repository ought to carry. */
function invalidCatalogs(extraRoots) {
	return [{
		catalogRoot: git("rev-parse", "--show-toplevel") ?? root,
		own: true
	}, ...extraRoots.map((r) => ({
		catalogRoot: path.resolve(r),
		own: false
	}))].flatMap(({ catalogRoot, own }) => {
		const rows = readJson_stdout(runCli("marketplace", "validate", "--format", "json", "--root", catalogRoot).stdout);
		return Array.isArray(rows) ? rows.filter((row) => row.status === "invalid").map((row) => ({
			...row,
			catalogRoot,
			own
		})) : [];
	});
}
/** Runs git inside `root`, returning its stdout or `null` — a non-zero status, a missing git, and a
*  directory outside any repository are all the same answer here: no history to read. */
function git(...args) {
	const result = spawnSync("git", [
		"-C",
		root,
		...args
	], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : null;
}
/** The commit that introduced the version the manifest carries now, walking `plugin.json`'s history
*  newest-first until the version changes. `null` when there is no history, or when the newest
*  committed manifest already disagrees — that version is uncommitted, so nothing shipped under it. */
function commitThatSetVersion(current) {
	const log = git("log", "--format=%H", "-100", "--", "plugin.json");
	if (log === null || log === "") return null;
	let introduced = null;
	for (const sha of log.split("\n").filter(Boolean)) {
		const blob = git("show", `${sha}:./plugin.json`);
		if (blob === null) break;
		let version;
		try {
			version = JSON.parse(blob).version;
		} catch {
			break;
		}
		if (version !== current) break;
		introduced = sha;
	}
	return introduced;
}
/** What a consumer installs, as pathspecs. The derived vendor manifests are deliberately absent —
*  they only ever change because the canonical manifest did, and counting both would report one
*  change twice. */
function shippedPaths() {
	return [
		"plugin.json",
		typeof ext?.skills === "string" ? ext.skills : "./skills/",
		"agents",
		"governances",
		"references",
		"mcp.json"
	].filter((rel) => fs.existsSync(path.join(root, rel)));
}
function readJson_stdout(stdout) {
	if (!stdout) return null;
	try {
		return JSON.parse(stdout);
	} catch {
		return null;
	}
}
function report({ vendors }) {
	const result = {
		root,
		manifest: manifest === null ? null : {
			name: manifest.name ?? null,
			version: manifest.version ?? null
		},
		vendors,
		findings,
		ok: findings.length === 0
	};
	process.stdout.write(`${JSON.stringify(result)}\n`);
	if (verbose) {
		process.stderr.write(result.ok ? "no findings\n" : `${findings.length} finding(s)\n`);
		for (const f of findings) process.stderr.write(`  [${f.severity}] ${f.code}: ${f.detail}\n`);
	}
	process.exit(0);
}
/** Where the npm package that ships this plugin lives, relative to the plugin root, as the CLI reads
*  it; `null` when the plugin ships to no package (the author-picks release model of ADR-0010 §2);
*  `undefined` when the CLI could not answer. */
function readPackagePath() {
	const result = runCli("config", "get", "--key", "packagePath", "--format", "json", "--root", root);
	if (result.status !== 0) return void 0;
	try {
		const declared = JSON.parse(result.stdout);
		return typeof declared === "string" || declared === null ? declared : void 0;
	} catch {
		return;
	}
}
//#endregion
export {};
