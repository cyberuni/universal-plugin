# Confirm an npm-distributed plugin

Read this when Step 2c's `config get --key packagePath --infer` prints a path, not `null`.

`--infer` also answers when no `packagePath` is declared: it prints `"."` when the plugin root's
own `package.json` is public and its `files` publish `plugin.json`. When the path was inferred (the command's stderr says to declare it), tell
the user that `.agents/universal-plugin.json` lacks `"packagePath": "."`, so `doctor` and the
version check miss the package, and offer to add it in the plugin's repository. Then confirm the
package really carries the manifest at this version:

```bash
npm view <npm-package-name>@<version> version
npm pack <plugin-root>/<packagePath> --dry-run --json
```

The `files` list `npm pack` prints must hold a `plugin.json` path. If it does not, the plugin is not
npm-distributed after all; fall through to Step 2c's next signal.

**Copilot CLI and Cursor cannot install an npm source**, so `marketplace add` leaves the plugin
out of those two catalogs and says so. List it there from git instead, with the source Step 2c's
`git-subdir` or `url` signal picks (`git-subdir` for a plugin below the repository root). The Claude Code and Codex
entries keep the `npm` source.
