#!/usr/bin/env node
// Runs `universal-plugin marketplace add` from the CLI that ships beside this skill, so listing a
// plugin never depends on a network fetch or on which version `npx` happens to resolve.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// <package>/skills/<skill>/scripts/add.mjs: four levels up is the package root.
const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))

process.argv.splice(2, 0, 'marketplace', 'add')
await import(join(packageRoot, 'bin', 'universal-plugin.mjs'))
