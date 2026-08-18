---
'universal-plugin': patch
---

Resolve `--root` to an absolute directory, and stop re-joining a workspace-relative root onto a cwd already inside it

In a pnpm monorepo a package is named by its workspace-relative path, so `--root packages/pods`
run from inside `packages/pods` resolved to `<repo>/packages/pods/packages/pods` — a directory
that does not exist — and `plugin build` reported `No plugin.json found` against that doubled
path (#43). Every command taking `--root` now resolves it against the cwd and, when the re-joined
path is missing while the cwd already ends with the given path, uses the cwd — the package that
was named.

`--root` also resolves to an absolute path in every case now. A relative root previously flowed
through unresolved, so `No plugin.json found at ../empty` named a fragment rather than the
directory searched, and `plugin init --root .` derived the plugin name from `path.basename('.')`
instead of the directory's own name.
