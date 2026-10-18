#!/usr/bin/env node
// Compiled by `universal-plugin plugin build` from src/skill-scripts/install-docs.ts. Edit the source, not this file.
globalThis.__SKILL_SCRIPT__ = {"package":"universal-plugin","bin":"universal-plugin","version":"0.15.0","entry":"skills/marketplace/scripts/install-docs.mjs","commands":{"marketplace add":"skills/marketplace/scripts/add.mjs","marketplace init":"skills/marketplace/scripts/marketplace.mjs","marketplace validate":"skills/marketplace/scripts/validate.mjs","plugin build":"skills/build-plugin/scripts/build.mjs","plugin init":"skills/init-universal-plugin/scripts/init.mjs","plugin version":"skills/version/scripts/version.mjs"}};
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
//#region src/marketplace/marketplace.ts
/** Whether a catalog entry's `source` names a place inside this repository — a `./`-prefixed path in
*  the Claude-shaped catalogs, or Codex's `{ source: "local", path }`. Every other form names a
*  plugin distributed from somewhere else: an npm package, a GitHub repository, a URL. Discovery
*  walks directories, so it can produce the first kind and can say nothing about the second. */
function isLocalCatalogSource(source) {
	if (typeof source === "string") return true;
	if (typeof source !== "object" || source === null || Array.isArray(source)) return false;
	return source.source === "local";
}
const GITHUB_URL = /^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/;
/** The source forms each runtime installs from.
*
*  Every runtime takes a repository path. Beyond that they diverge, and the divergence is not
*  cosmetic: a catalog is read at install time in someone else's terminal, so a source a runtime
*  cannot resolve is a failure far from here. Claude Code's schema documents the full tagged set
*  (<https://json.schemastore.org/claude-code-marketplace.json>). The rest was found by running the
*  CLIs (`.research/local-marketplaces`, "Remote entry sources"):
*
*  - Codex installs `npm`, `url` and `git-subdir`, and silently drops a `github` entry.
*  - Copilot CLI installs `github` (also with `path`) and `url`, and refuses the *whole*
*    marketplace over a single `npm` or `git-subdir` entry.
*  - Cursor's shipped bundle resolves `github`, `url` and `git-subdir`, all by git URL, and has no
*    `npm` source. Read from the bundle, not run. */
const TARGET_SOURCE_KINDS = {
	claude: [
		"path",
		"npm",
		"github",
		"url",
		"git-subdir"
	],
	codex: [
		"path",
		"npm",
		"url",
		"git-subdir"
	],
	copilot: [
		"path",
		"github",
		"url"
	],
	cursor: [
		"path",
		"github",
		"url",
		"git-subdir"
	]
};
/** The kind name used to decide whether a runtime accepts a source: a repository path, or the tag. */
function sourceKindOf(source) {
	if (isLocalCatalogSource(source)) return "path";
	return typeof source === "string" ? "path" : source.source;
}
function pickPins(source) {
	const pins = {};
	if (typeof source.ref === "string") pins.ref = source.ref;
	if (typeof source.sha === "string") pins.sha = source.sha;
	return pins;
}
/** A git URL ending in `.git`, which Cursor requires of `url` and `git-subdir`. Only a GitHub URL is
*  known to serve the same repository with the suffix, so any other host's URL is left as written. */
function withGitSuffix(url) {
	if (/\.git$/.test(url)) return url;
	return GITHUB_URL.test(url) ? `${url.replace(/\/+$/, "")}.git` : void 0;
}
/** Turns a source into the closest one a runtime installs, or says why none exists.
*
*  A mapping is made only where it is lossless: `github` becomes a `url` (or, with a `path`, a
*  `git-subdir`) on Codex, and a `git-subdir` on a GitHub URL becomes `github` + `path` on Copilot
*  CLI. `ref` and `sha` pins cross with it. Anything else the runtime cannot install is omitted,
*  because writing it would have the runtime drop the entry or refuse the whole catalog. */
function adaptSource(target, source) {
	const kind = sourceKindOf(source);
	if (kind === "path" || typeof source === "string") return { source };
	const supported = TARGET_SOURCE_KINDS[target].includes(kind);
	if ((target === "codex" || target === "cursor" && typeof source.path === "string") && kind === "github" && typeof source.repo === "string") {
		const url = `https://github.com/${source.repo}.git`;
		return typeof source.path === "string" ? { source: {
			source: "git-subdir",
			url,
			path: source.path,
			...pickPins(source)
		} } : { source: {
			source: "url",
			url,
			...pickPins(source)
		} };
	}
	if (target === "copilot" && kind === "git-subdir" && typeof source.url === "string" && typeof source.path === "string") {
		const match = GITHUB_URL.exec(source.url.trim());
		if (match) return { source: {
			source: "github",
			repo: match[1],
			path: source.path,
			...pickPins(source)
		} };
		return { omitted: "git-subdir is installable only from a GitHub URL, which is mapped to github with a path" };
	}
	if (!supported) return { omitted: `${kind} source is not supported by ${target}` };
	if (target === "cursor" && (kind === "url" || kind === "git-subdir") && typeof source.url === "string") {
		const url = withGitSuffix(source.url);
		if (url === void 0) return { omitted: `cursor requires a ".git" URL for a ${kind} source` };
		return { source: url === source.url ? source : {
			...source,
			url
		} };
	}
	return { source };
}
//#endregion
//#region src/skill-scripts/install-docs.ts
const argv = process.argv.slice(2);
const rootFlag = argv.indexOf("--root");
const root = path.resolve(rootFlag === -1 ? process.cwd() : argv[rootFlag + 1] ?? process.cwd());
const slugFlag = argv.indexOf("--repo");
const readJson = (file) => {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
};
/** owner/repo, from the flag, the manifest's repository field, or the git remote. */
function resolveSlug() {
	if (slugFlag !== -1 && argv[slugFlag + 1]) return argv[slugFlag + 1];
	const manifest = readJson(path.join(root, "plugin.json"));
	const fromManifest = (typeof manifest?.repository === "string" ? manifest.repository : manifest?.repository?.url)?.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1];
	if (fromManifest) return fromManifest;
	try {
		return execFileSync("git", [
			"-C",
			root,
			"remote",
			"get-url",
			"origin"
		], {
			encoding: "utf8",
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		}).match(/github\.com[/:]([^/]+\/[^/.\s]+)/)?.[1] ?? null;
	} catch {
		return null;
	}
}
const slug = resolveSlug();
const repoRef = slug ?? "<owner>/<repo>";
const claude = readJson(path.join(root, ".claude-plugin/marketplace.json"));
const copilot = readJson(path.join(root, ".github/plugin/marketplace.json"));
const codex = readJson(path.join(root, ".agents/plugins/marketplace.json")) ?? claude;
const cursor = readJson(path.join(root, ".cursor-plugin/marketplace.json"));
const targets = [];
const sections = [];
const pluginNames = (catalog) => (catalog?.plugins ?? []).map((p) => p.name).filter(Boolean);
const installableNames = (target, catalog) => (catalog?.plugins ?? []).filter((p) => p?.name && p.source !== void 0 && !("omitted" in adaptSource(target, p.source))).map((p) => p.name);
const notInstallable = (installed, label) => {
	const missing = pluginNames(claude).filter((name) => !installed.includes(name));
	return missing.length === 0 ? "" : `\n\nNot installable on ${label}: ${missing.join(", ")}.`;
};
if (claude) {
	const names = pluginNames(claude);
	const installs = (names.length > 0 ? names : ["<plugin>"]).map((n) => `/plugin install ${n}@${claude.name}`);
	targets.push("claude-code");
	sections.push([
		"**Claude Code**",
		"",
		"```",
		`/plugin marketplace add ${repoRef}`,
		...installs,
		"```"
	].join("\n"));
}
if (copilot) {
	const names = installableNames("copilot", copilot);
	const installs = (names.length > 0 ? names : ["<plugin>"]).map((n) => `copilot plugin install ${n}@${copilot.name}`);
	targets.push("copilot-cli");
	sections.push([[
		"**GitHub Copilot CLI**",
		"",
		"```",
		`copilot plugin marketplace add ${repoRef}`,
		...installs,
		"```"
	].join("\n"), notInstallable(names, "Copilot CLI")].join(""));
}
if (codex) {
	const names = installableNames("codex", codex);
	const installs = (names.length > 0 ? names : ["<plugin>"]).map((n) => `codex plugin add ${n}@${codex.name}`);
	targets.push("codex");
	sections.push([
		"**Codex**",
		"",
		"```",
		`codex plugin marketplace add ${repoRef}`,
		...installs,
		"```",
		"",
		"Start a new session before using the plugin."
	].join("\n").concat(notInstallable(names, "Codex")));
}
if (cursor) {
	targets.push("cursor");
	sections.push([
		"**Cursor**",
		"",
		"This repository carries a Cursor catalog, but Cursor has no command that adds it from a",
		"local path: a team admin imports the repository from the Cursor dashboard. To try the plugin",
		"before then, run `npx universal-plugin plugin install --vendor cursor` in a clone, then",
		"reload the window."
	].join("\n"));
}
const markdown = sections.length === 0 ? "" : [
	"## Install",
	"",
	sections.join("\n\n"),
	""
].join("\n");
process.stdout.write(`${JSON.stringify({
	root,
	repo: slug,
	repoResolved: slug !== null,
	targets,
	markdown
})}\n`);
//#endregion
export {};
