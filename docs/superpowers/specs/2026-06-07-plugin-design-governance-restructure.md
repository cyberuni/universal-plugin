# Plugin Design Governance Restructure

**Date:** 2026-06-07
**Status:** Approved

## Problem

`governances/plugin-design.md` is the authoritative governance for authoring universal plugins, but:

1. It lives at repo root under `governances/` (project scope) — not bundled with the npm package, so `universal-plugin governance show plugin-design` fails for users who don't clone the repo.
2. `governances/cli-command.md` (internal CLI dev conventions) is co-located with the public governance, making it visible to plugin authors who shouldn't care about it.
3. `.plugin/governances/plugin-design.md` is a stale shorter duplicate.
4. `vendorExtensions.claude-code.governances` in `.plugin/plugin.json` points at `./governances/` but that field is not wired in Claude Code today — it's placeholder noise.
5. Content references `npx cyber-skills@<version>` — outdated after rename to `universal-plugin`.

## Design

### File moves

| Action | From | To |
|---|---|---|
| Move | `governances/plugin-design.md` | `packages/universal-plugin/governances/plugin-design.md` |
| Move | `governances/cli-command.md` | `.agents/governances/cli-command.md` |
| Delete | `.plugin/governances/plugin-design.md` | — |

`packages/universal-plugin/governances/` is where `getPackageDir()` resolves at runtime (sibling of `dist/`). Files there ship with the npm package and become accessible via the `package` scope.

`.agents/governances/` is a new project-private governance location. It is gitignored-safe for local overrides and holds dev-internal governance that should not be visible to plugin authors.

### npm packaging

Add `"governances"` to `packages/universal-plugin/package.json#files` so governance files are included in the published package.

### New `local` scope in `governance.ts`

Add a fifth scope `local` = `<root>/.agents/governances`, inserted between `project` and `user` in priority order:

```
managed → project → local → user → package
```

Update `Scope` type and `getScopedPaths()`. `listGovernances` and `showGovernance` pick it up automatically via the existing loop.

### `.plugin/plugin.json`

Remove `governances: "./governances/"` from `vendorExtensions.claude-code`. That field is not wired in Claude Code today; removing it avoids a stale path reference after the move.

### Content update

In `packages/universal-plugin/governances/plugin-design.md`, replace:

```
npx cyber-skills@<version> governance show ...
```

with:

```
npx universal-plugin@<version> governance show ...
```

Do a full content review pass for any other stale references during the move.

## Scope type after change

```ts
export type Scope = 'managed' | 'project' | 'local' | 'user' | 'package' | 'store'
```

`getScopedPaths` becomes:

```ts
export function getScopedPaths(root: string): ScopedPath[] {
  return [
    { scope: 'managed', dir: getManagedDir() },
    { scope: 'project', dir: getProjectDir(root) },
    { scope: 'local', dir: getLocalDir(root) },
    { scope: 'user', dir: getUserDir() },
    { scope: 'package', dir: getPackageDir() },
  ]
}

export function getLocalDir(root: string): string {
  return path.join(root, '.agents', 'governances')
}
```

## Out of scope

- Consuming governance (deferred — not enough distinct content yet)
- Claude Code native governance integration (deferred — field removed for now)
- `plugin.json` path update for `governances` field (removed entirely)
