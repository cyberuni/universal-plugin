#!/usr/bin/env node
// Compiled by `universal-plugin plugin build` from src/skill-scripts/doctor.ts. Edit the source, not this file.
globalThis.__SKILL_SCRIPT__ = {"package":"universal-plugin","bin":"universal-plugin","version":"0.21.0","entry":"skills/doctor-universal-plugin/scripts/doctor.mjs","commands":{"marketplace add":"skills/marketplace/scripts/add.mjs","marketplace init":"skills/marketplace/scripts/marketplace.mjs","marketplace update":"skills/marketplace/scripts/update.mjs","marketplace validate":"skills/marketplace/scripts/validate.mjs","plugin build":"skills/build-plugin/scripts/build.mjs","plugin init":"skills/init-universal-plugin/scripts/init.mjs","plugin version":"skills/version/scripts/version.mjs"}};
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
// src/compile/scripts.ts
/** The global the header assigns the script data to. Framework-neutral: a script's own code, or the
*  library it inlines, reads it; universal-plugin depends on neither. */
const SCRIPT_GLOBAL = "__SKILL_SCRIPT__";
// src/skill-scripts/cli-runner.ts
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
// src/skill-scripts/doctor.ts
const UP_NAMESPACE = "org.cyberuni.universal-plugin";
const argv = process.argv.slice(2);
const verbose = argv.includes("--verbose");
const rootFlag = argv.indexOf("--root");
const root = path.resolve(rootFlag === -1 ? process.cwd() : argv[rootFlag + 1] ?? process.cwd());
const marketplaceRoots = argv.flatMap((arg, i) => arg === "--marketplace-root" ? [argv[i + 1]] : []).filter(Boolean);
const findings = [];
/** semantic-release's version placeholder until its publish run stamps the real number. */
const UNSTAMPED_VERSION = "0.0.0-development";
/** The config files release-it reads, besides the `release-it` key of package.json. */
const RELEASE_IT_FILES = [
	"json",
	"yaml",
	"yml",
	"toml",
	"js",
	"cjs",
	"mjs",
	"ts"
].map((ext) => `.release-it.${ext}`);
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
const inferredPackagePath = packagePath === null ? readInferredPackagePath() : null;
if (typeof inferredPackagePath === "string") add("undeclared-package-path", "medium", "the plugin root holds a public package.json that publishes plugin.json, but .agents/universal-plugin.json declares no packagePath — publish-plugin and marketplace add treat the plugin as git-distributed", `declare "packagePath": "${inferredPackagePath}" in .agents/universal-plugin.json, or set "private": true if it is not published`);
/** Where the npm package that ships this plugin lives, declared or inferred; `null` for none. */
const npmPackagePath = packagePath ?? inferredPackagePath ?? null;
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
	else if (/(rejects|accepts) (an author|repository)/.test(warning)) add("unaccepted-metadata", "high", warning, "rewrite the field in plugin.json as the warning says, then plugin build");
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
if (manifest.version !== void 0 && npmPackagePath === null && releaseTool() === null) {
	const introduced = commitThatSetVersion(manifest.version);
	if (introduced !== null) {
		const files = (git("diff", "--name-only", `${introduced}..HEAD`, "--", ...shippedPaths()) ?? "").split("\n").filter(Boolean);
		if (files.length > 0) {
			const sample = files.slice(0, 3).join(", ");
			add("unreleased-content", "medium", `${files.length} shipped file(s) changed since ${manifest.version} was set (${sample}${files.length > 3 ? ", …" : ""}) — a consumer keyed on that version never re-extracts them`, "/universal-plugin:version");
		}
	}
}
for (const finding of changesetsReleaseFindings()) add(...finding);
for (const finding of releasePleaseReleaseFindings()) add(...finding);
for (const file of releaseItConfigsWithoutStamp()) add("release-it-no-stamp", "high", `${file} configures release-it, but no hook runs plugin version — the release is tagged with plugin.json and the vendor manifests still on the previous version`, "add \"hooks\": { \"after:bump\": \"universal-plugin plugin version ${version}\" } to the release-it config");
for (const finding of semanticReleaseFindings()) add(...finding);
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
/** The release-config gaps of a non-npm plugin in a changesets repository: no `packagePath`, and a
*  plugin-root package.json that is absent or private. An npm-shipped plugin is not checked here —
*  `changeset publish` there publishes to npm whatever the private-package settings say. */
function changesetsReleaseFindings() {
	if (packagePath !== null) return [];
	const repoRoot = git("rev-parse", "--show-toplevel") ?? root;
	const workspace = changesetsWorkspace(repoRoot);
	if (workspace === void 0) return [];
	const pkg = readJson(path.join(root, "package.json"));
	const out = [];
	if (pkg === null) out.push([
		"changesets-no-package",
		"high",
		"the repository is released with changesets, but the plugin root has no package.json — changesets releases only a package, so changeset version and changeset publish fail",
		"/universal-plugin:init-universal-plugin — it writes a private package.json (name, \"private\": true, version)"
	]);
	const setting = readJson(path.join(workspace, ".changeset", "config.json"))?.privatePackages;
	if (!(typeof setting === "object" && setting !== null && setting.version !== false && setting.tag === true)) out.push([
		"changesets-private-untagged",
		"high",
		".changeset/config.json does not set \"privatePackages\": { \"version\": true, \"tag\": true } — changeset publish creates no tag for a private package, so no release is made",
		"set \"privatePackages\": { \"version\": true, \"tag\": true } in .changeset/config.json"
	]);
	for (const workflow of changesetsWorkflowsWithoutPublish(repoRoot)) out.push([
		"changesets-no-publish-script",
		"high",
		`${workflow} runs changesets/action with no publish script — after the Version Packages PR merges it does nothing, so no tag or release is made`,
		"add `publish-script: pnpm release` (changesets/action v1: `publish:`) to the changesets/action step, with a \"release\" script running changeset publish"
	]);
	return out;
}
/** The directory holding `.changeset/` for a non-npm plugin a changesets repository releases: the
*  plugin root or the repository root, with a plugin-root package.json that is absent or private.
*  `undefined` when changesets does not release this plugin as a non-npm one. */
function changesetsWorkspace(repoRoot) {
	const workspace = [root, repoRoot].find((dir) => fs.existsSync(path.join(dir, ".changeset")));
	if (workspace === void 0) return void 0;
	const pkg = readJson(path.join(root, "package.json"));
	return pkg !== null && pkg.private !== true ? void 0 : workspace;
}
/** The release tool that picks a non-npm plugin's next version, or `null` when the author picks it
*  (ADR-0010 §6). Each tool moves the number at release time, from what accumulated since the last
*  release: changesets from changeset files, release-please and semantic-release from commits,
*  release-it from its prompt or increment argument. Config is looked for where each tool loads it:
*  the plugin root and the repository root. */
function releaseTool() {
	const repoRoot = git("rev-parse", "--show-toplevel") ?? root;
	if (changesetsWorkspace(repoRoot) !== void 0) return "changesets";
	const rpConfig = readJson(path.join(repoRoot, "release-please-config.json"));
	if (rpConfig !== null && releasePleaseBumpsManifest(rpConfig, repoRoot)) return "release-please";
	const dirs = [.../* @__PURE__ */ new Set([root, repoRoot])];
	if (dirs.some((dir) => semanticReleaseConfig(dir) !== null)) return "semantic-release";
	if (dirs.some((dir) => hasConfig(dir, RELEASE_IT_FILES, "release-it"))) return "release-it";
	return null;
}
/** Whether `dir` holds one of the config files `files`, or a package.json carrying `key`. */
function hasConfig(dir, files, key) {
	if (files.some((file) => fs.existsSync(path.join(dir, file)))) return true;
	const pkg = readJson(path.join(dir, "package.json"));
	return pkg !== null && typeof pkg === "object" && Object.hasOwn(pkg, key);
}
/** The release-please gap of a non-npm plugin: `release-please-config.json` bumps this plugin's
*  plugin.json through `extra-files`, and no workflow runs `plugin version` to restamp the rest, or
*  the restamp is pushed with the default `GITHUB_TOKEN` and so gets no checks. A plugin with `packagePath` is not checked: its number comes from the package, through
*  `--from-package`. */
function releasePleaseReleaseFindings() {
	if (packagePath !== null) return [];
	const repoRoot = git("rev-parse", "--show-toplevel") ?? root;
	const config = readJson(path.join(repoRoot, "release-please-config.json"));
	if (config === null || !releasePleaseBumpsManifest(config, repoRoot)) return [];
	if (!workflowsMention(repoRoot, /plugin version|version\.mjs/)) return [[
		"release-please-no-restamp",
		"high",
		"release-please-config.json bumps plugin.json through extra-files, but no workflow runs plugin version — the release PR leaves the vendor manifests, catalogs, skill pins and compiled scripts on the old version",
		"add a workflow step on the release PR branch that runs `universal-plugin plugin version --from-manifest` and pushes the stamped files (see the version skill)"
	]];
	return restampWorkflowsWithoutCi(repoRoot).map((workflow) => [
		"release-please-restamp-no-ci",
		"medium",
		`${workflow} pushes the --from-manifest restamp with the default GITHUB_TOKEN — that push starts no workflow run, so the release PR's checks never run on its head commit and a required check blocks the merge`,
		"mint a GitHub App token with actions/create-github-app-token and pass it to release-please-action and actions/checkout as `token:` (see the version skill)"
	]);
}
/** Workflow files that restamp with `--from-manifest`, push, and leave the push on the default
*  `GITHUB_TOKEN`, which starts no workflow run. Read as text, so it clears a file on any sign of
*  another credential: a GitHub App token, a deploy key, or a `token:` input that is not the default
*  token. A workflow dispatch does not clear it: its checks do not count toward a required check. */
function restampWorkflowsWithoutCi(repoRoot) {
	const startsCi = /create-github-app-token|ssh-key:|token:\s*\$\{\{(?!\s*(?:secrets\.GITHUB_TOKEN|github\.token)\b)/;
	return workflowFiles(repoRoot).filter(({ text }) => /--from-manifest/.test(text) && /git push/.test(text) && !startsCi.test(text)).map(({ file }) => file);
}
/** Whether a release-please config lists this plugin's plugin.json in `extra-files`. A package's own
*  `extra-files` replaces the top-level default. A path is relative to the package path, or to the
*  repository root with a leading `/`. */
function releasePleaseBumpsManifest(config, repoRoot) {
	const target = path.join(root, "plugin.json");
	const packages = config.packages ?? {};
	return Object.entries(packages).some(([packageDir, options]) => {
		const extra = options?.["extra-files"] ?? config["extra-files"];
		if (!Array.isArray(extra)) return false;
		return extra.some((entry) => {
			const file = typeof entry === "string" ? entry : entry?.path;
			if (typeof file !== "string") return false;
			return (file.startsWith("/") ? path.join(repoRoot, file) : path.join(repoRoot, packageDir, file)) === target;
		});
	});
}
/** The semantic-release wiring gaps, for the config at the plugin root and at the repository root.
*  Each config is read as text, so a JavaScript config is checked only for what it names. A config
*  that `extends` a shareable config is skipped: the wiring may live in the shared one. */
function semanticReleaseFindings() {
	const repoRoot = git("rev-parse", "--show-toplevel") ?? root;
	return [.../* @__PURE__ */ new Set([root, repoRoot])].flatMap((dir) => {
		const config = semanticReleaseConfig(dir);
		if (config === null || /\bextends\b/.test(config.text)) return [];
		const label = path.relative(root, path.join(dir, config.file)) || config.file;
		const out = [];
		const stamp = /\bprepareCmd\b['"]?\s*:\s*(?:[>|][-+]?\s*\n\s*)?[^,\n}]*(?:\bplugin\s+version\b|version\.mjs)/.exec(config.text);
		if (stamp !== null) out.push(...semanticReleaseCommitFindings(config, label, stamp.index));
		if (stamp === null) out.push([
			"semantic-release-no-stamp",
			"high",
			`${label} configures semantic-release, but no @semantic-release/exec prepareCmd runs plugin version — the release is tagged with plugin.json, the vendor manifests and the catalogs still on the previous version`,
			"add [\"@semantic-release/exec\", { \"prepareCmd\": \"universal-plugin plugin version ${nextRelease.version}\" }] before @semantic-release/git — /universal-plugin:init-universal-plugin wires it"
		]);
		const runsNpm = /@semantic-release\/npm(?![\w-])/.test(config.text) || !/\bplugins\b/.test(config.text);
		if (packagePath === null && runsNpm) out.push([
			"semantic-release-npm-unshipped",
			"high",
			`${label} runs @semantic-release/npm, but the plugin ships to no npm package — with no package.json the release fails (ENOPKG), and with one it still rewrites that version`,
			"remove @semantic-release/npm from the plugins list (write the list out if the config relies on the defaults) — /universal-plugin:init-universal-plugin wires it"
		]);
		return out;
	});
}
/** The commit-back gaps of a semantic-release config whose `prepareCmd` stamps at `stampAt`.
*  semantic-release runs each plugin's `prepare` in `plugins` list order and tags the commit the
*  last one leaves, so the stamped files reach the tag only when `@semantic-release/git` exists and
*  comes after `@semantic-release/exec`. A `prepareCmd` that runs `git commit` itself also counts.
*  The order is read only from a JSON or YAML config with no top-level `prepare` key: there the text
*  order is the list order, while a JavaScript config may build the list from variables. */
function semanticReleaseCommitFindings(config, label, stampAt) {
	const git = /['"]@semantic-release\/git['"]/.exec(config.text);
	if (git === null) {
		if (/\bgit\s+commit\b/.test(config.text)) return [];
		const shipsToNpm = packagePath !== null;
		return [[
			"semantic-release-no-commit",
			shipsToNpm ? "medium" : "high",
			`${label} stamps the version with @semantic-release/exec, but runs no @semantic-release/git to commit the stamped files — the release tag points at plugin.json, the vendor manifests and the catalogs still on the previous version${shipsToNpm ? ", so only the npm package carries the new number" : ""}`,
			"add [\"@semantic-release/git\", { \"assets\": [...] }] after @semantic-release/exec, with assets of plugin.json, the vendor manifests, the catalogs, skills/**, .plugin/pins.json and the mcp file — /universal-plugin:init-universal-plugin wires it"
		]];
	}
	const literal = config.file === "package.json" || /^(?:\.config\/)?\.?releaserc(?:\.json|\.ya?ml)?$/.test(config.file);
	const overridesPrepare = /^\s*['"]?prepare['"]?\s*:/m.test(config.text);
	if (!literal || overridesPrepare || git.index > stampAt) return [];
	return [[
		"semantic-release-git-before-exec",
		"high",
		`${label} lists @semantic-release/git before the @semantic-release/exec that stamps the version — plugins prepare in list order, so the release commit and tag carry plugin.json, the vendor manifests and the catalogs from before the stamp`,
		"move @semantic-release/exec above @semantic-release/git in the plugins list"
	]];
}
/** The semantic-release config semantic-release would read in `dir`, as text, or `null` when there
*  is none. The search order is cosmiconfig 9's default for the module name `release`: the `release`
*  key of package.json, then the files below. The first one found is the only one read. */
function semanticReleaseConfig(dir) {
	const rc = [
		"",
		".json",
		".yaml",
		".yml",
		".js",
		".ts",
		".cjs",
		".mjs"
	];
	const files = [
		...rc.map((ext) => `.releaserc${ext}`),
		...rc.map((ext) => `.config/releaserc${ext}`),
		...[
			".js",
			".ts",
			".cjs",
			".mjs"
		].map((ext) => `release.config${ext}`)
	];
	const fromPackage = readJson(path.join(dir, "package.json"))?.release;
	if (fromPackage !== void 0 && fromPackage !== null) return {
		file: "package.json",
		text: JSON.stringify(fromPackage, null, 2)
	};
	for (const file of files) {
		const abs = path.join(dir, file);
		if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return {
			file,
			text: fs.readFileSync(abs, "utf8")
		};
	}
	return null;
}
/** Whether any workflow file's text matches. */
function workflowsMention(repoRoot, pattern) {
	return workflowFiles(repoRoot).some(({ text }) => pattern.test(text));
}
/** The workflow files under `.github/workflows`, each with its path from the repository root and its text. */
function workflowFiles(repoRoot) {
	const dir = path.join(repoRoot, ".github", "workflows");
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter((file) => /\.ya?ml$/.test(file)).map((file) => ({
		file: `.github/workflows/${file}`,
		text: fs.readFileSync(path.join(dir, file), "utf8")
	}));
}
/** Workflow files that run changesets/action and give it no publish command. Read as text: a step
*  names it as `publish-script:` (v2) or `publish:` (v1). */
function changesetsWorkflowsWithoutPublish(repoRoot) {
	const dir = path.join(repoRoot, ".github", "workflows");
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter((file) => /\.ya?ml$/.test(file)).filter((file) => {
		const text = fs.readFileSync(path.join(dir, file), "utf8");
		return /uses:\s*['"]?changesets\/action@/.test(text) && !/^\s*(publish-script|publish)\s*:/m.test(text);
	}).map((file) => `.github/workflows/${file}`);
}
/** release-it configs, at the plugin root or the repository root, that never call `plugin version`.
*  release-it reads `.release-it.{json,yaml,yml,toml,js,cjs,mjs,ts}` or the `release-it` key of
*  package.json. Each is read as text, so the check is only that the stamp is named somewhere. */
function releaseItConfigsWithoutStamp() {
	const repoRoot = git("rev-parse", "--show-toplevel") ?? root;
	const stamps = (text) => /\bplugin\s+version\b/.test(text);
	return [.../* @__PURE__ */ new Set([root, repoRoot])].flatMap((dir) => {
		const label = (file) => path.relative(root, path.join(dir, file)) || file;
		const found = RELEASE_IT_FILES.filter((file) => fs.existsSync(path.join(dir, file))).filter((file) => !stamps(fs.readFileSync(path.join(dir, file), "utf8"))).map(label);
		const config = readJson(path.join(dir, "package.json"))?.["release-it"];
		if (config !== void 0 && !stamps(JSON.stringify(config))) found.push(label("package.json"));
		return found;
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
/** The packagePath the CLI infers from the plugin root's package.json; `undefined` when the CLI
*  cannot answer `--infer`. */
function readInferredPackagePath() {
	const result = runCli("config", "get", "--key", "packagePath", "--infer", "--format", "json", "--root", root);
	if (result.status !== 0) return void 0;
	try {
		const inferred = JSON.parse(result.stdout);
		return typeof inferred === "string" ? inferred : void 0;
	} catch {
		return;
	}
}
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
export {};
