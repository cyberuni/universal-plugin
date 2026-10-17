#!/usr/bin/env node
// Compiled by `universal-plugin plugin build` from src/skill-scripts/run-cli.ts. Edit the source, not this file.
globalThis.__SKILL_SCRIPT__ = {"package":"universal-plugin","bin":"universal-plugin","version":"0.15.0","entry":"skills/marketplace/scripts/add.mjs","commands":{"marketplace add":"skills/marketplace/scripts/add.mjs","marketplace init":"skills/marketplace/scripts/marketplace.mjs","marketplace validate":"skills/marketplace/scripts/validate.mjs","plugin build":"skills/build-plugin/scripts/build.mjs","plugin init":"skills/init-universal-plugin/scripts/init.mjs","plugin version":"skills/version/scripts/version.mjs"}};
import { spawnSync } from "node:child_process";
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
function runCli(args, options = {}) {
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
//#region src/skill-scripts/run-cli.ts
const script = skillScript();
const command = Object.entries(script.commands).find(([, entry]) => entry === script.entry)?.[0];
if (command === void 0) {
	process.stderr.write(`${script.entry} declares no command in the scripts map\n`);
	process.exit(1);
}
const result = runCli([...command.split(" "), ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
//#endregion
export {};
