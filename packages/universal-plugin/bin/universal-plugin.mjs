#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// `import()` takes a URL, not a path: a Windows path such as `D:\…` reads as the URL scheme `d:` and
// Node rejects it with ERR_UNSUPPORTED_ESM_URL_SCHEME (issue #250).
const dir = dirname(fileURLToPath(import.meta.url))
await import(pathToFileURL(join(dir, '..', 'dist', 'cli.mjs')).href)
