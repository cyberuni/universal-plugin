#!/usr/bin/env node
// A skill launcher for one CLI command. `plugin build` compiles this file once per declared command
// (`scripts` in plugin.json); the command is the one the compiled file's own path is declared for.
//
// The full CLI is far over the compiled-script budget, so the launcher calls it instead of inlining
// it: the CLI the project installed (`pnpm exec`, which pnpm guarantees for a direct dependency), then
// the CLI pinned to the version this skill shipped with (`npx`).
import { runCli, skillScript } from './cli-runner.js'

const script = skillScript()
const command = Object.entries(script.commands).find(([, entry]) => entry === script.entry)?.[0]
if (command === undefined) {
	process.stderr.write(`${script.entry} declares no command in the scripts map\n`)
	process.exit(1)
}
const result = runCli([...command.split(' '), ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
