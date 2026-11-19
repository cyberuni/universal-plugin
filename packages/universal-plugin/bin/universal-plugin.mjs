#!/usr/bin/env node
// A literal relative specifier, so a forwarder can tell whether the build output is there (ADR 0022
// §3). It resolves against this file's URL, never as a Windows path (issue #250).
await import('../dist/cli.mjs')
