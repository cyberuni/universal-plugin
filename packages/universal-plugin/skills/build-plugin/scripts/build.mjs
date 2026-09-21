#!/usr/bin/env node
// Runs `universal-plugin plugin build` from the CLI that ships beside this skill, so the manifests a
// plugin ships are derived by the version the author installed, never by one `npx` resolves.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// <package>/skills/<skill>/scripts/build.mjs: four levels up is the package root.
const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))

process.argv.splice(2, 0, 'plugin', 'build')
await import(join(packageRoot, 'bin', 'universal-plugin.mjs'))
