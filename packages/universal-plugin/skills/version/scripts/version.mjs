#!/usr/bin/env node
// Runs `universal-plugin plugin version` from the CLI that ships beside this skill, so a release
// number never depends on a network fetch or on which version `npx` happens to resolve.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// <package>/skills/<skill>/scripts/version.mjs: four levels up is the package root.
const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))

process.argv.splice(2, 0, 'plugin', 'version')
await import(join(packageRoot, 'bin', 'universal-plugin.mjs'))
