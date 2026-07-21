#!/usr/bin/env node
// Hand-rolled entry — deliberately NOT commander. `upx` is a lean standalone bin (a second bin
// alongside the main `universal-plugin` CLI) whose whole value proposition is fast cold-start, so
// it must not pay commander's parse/require cost on every invocation.
import { realRunFs } from './fs.js'
import { runUpx } from './run.js'

const outcome = runUpx(process.argv.slice(2), realRunFs())

if (outcome.kind === 'help') {
	process.stdout.write(outcome.text)
	process.exit(0)
}

if (outcome.kind === 'error') {
	process.stderr.write(`${outcome.message}\n`)
	process.exit(1)
}

if (outcome.notice) process.stderr.write(`${outcome.notice}\n`)
process.exit(outcome.code)
