---
title: migrate-plugin
description: Move a repository-root or sibling-workspace plugin into the npm package that ships it.
---

Moves one existing plugin — at the repository root or in its own workspace member such as
`plugins/<name>/` — into the npm package that will distribute it. The package becomes the plugin root
and must contain every runtime artifact it needs after installation, including a CLI that runs
without `node_modules`.

It does not create a plugin from scratch, publish a package, or move project-local agent
configuration unrelated to the plugin.

## What moves

Every plugin asset in the source root: the canonical `plugin.json`, each vendor manifest directory,
`.plugin/`, and the component directories (`skills/`, `agents/`, `commands/`, `hooks/`, `rules/`,
`output-styles/`). Anything that existed only to host the plugin in its old place — a
workspace-member `package.json`, its `pnpm-workspace.yaml` entry — is deleted rather than moved.
Project configuration under `.agents/skills/` and a repository's marketplace catalog stay put.

## npm packaging

Every moved artifact is added to the destination package's `package.json` `files` allowlist —
existing entries such as `bin` and `dist` are kept, never replaced wholesale.

## Bundling the CLI

An installed agent plugin is a copy of a source checkout, not an npm install, so it has no reliable
`node_modules`. When the package ships a CLI, the skill splits its `tsdown.config.ts` into a library
build that keeps dependencies external and a CLI build that inlines every runtime dependency, so the
CLI runs standalone once installed as a plugin. It verifies the result by packing into a scratch
directory and running the CLI from the extracted tarball, outside the workspace where hoisted
`node_modules` would hide a missing inline.

## Release wiring

The skill repoints `packagePath`, the repository's build scripts, and any local-directory `source` in
the marketplace catalog at the new package directory, then searches the repository for stale
references to the old plugin path in lint excludes, `AGENTS.md`, docs, and scoped guards. Historical
records — changelogs, ADRs, research notes — are left as written.

The move and the CLI bundling land as separate commits, so each is revertable on its own.

## See also

- [`publish-plugin`](../publish-plugin/) — lists the packaged plugin once it ships
- [Choosing a runner](../../concepts/npx-and-upx/) — the CLI contract a bundled entry has to satisfy
