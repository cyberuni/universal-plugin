---
name: build-plugin
description: Use this skill to build a universal agent plugin — regenerate the Claude Code, Cursor, and Codex manifests and the Copilot CLI component tree from the canonical plugin.json, after editing the manifest, a skill, an agent, a hook, or a command. It also refreshes this plugin's entry in the repository's marketplace catalogs and the governance copies inside its skills, and checks those copies in CI. Trigger on "build the plugin", "regenerate the vendor manifests", "sync the manifests after my change", "run plugin build", "update .claude-plugin/plugin.json", or "check the governance copies are current".
---

# Build a plugin

Derive every vendor's form of the plugin from the one canonical `plugin.json`.

The canonical root `plugin.json` is the only manifest anyone authors. Everything a runtime reads
beside it is **derived**, and this build is the one step that writes all of it:

| Derived artifact | Read by |
|---|---|
| `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json` | Claude Code, Cursor, Codex |
| `com.github.copilot/` (agents, commands, rules, hooks, LSP) | Copilot CLI in spec mode; the manifest itself is root `plugin.json` |
| this plugin's entry in each marketplace catalog the repository already carries | anyone installing from the repository |
| `skills/*/references/governances/*.md` copies | the skills that declare them |

So a change to the plugin is not done until it has been built. A runtime reads the derived files,
not the canonical manifest, and a derived file that predates the change still ships the old plugin.

## Step 0: Is this the right skill?

| The ask is | Use instead |
|---|---|
| declare a new vendor, component, or field | `init-universal-plugin` edits `plugin.json`, then builds |
| move the version | `version`: it writes the number and builds |
| delete derived manifests, or drop a vendor | `remove-plugin` |
| "the build says built 0" or a runtime loads nothing | `doctor-universal-plugin` |

Everything else that ends in "regenerate what the runtimes read" is here.

## Step 1: Find how the project builds

```bash
grep -n "plugin build" package.json
```

If a script already runs `plugin build`, run that script (for example `pnpm plugin:build`). It
carries the project's own `--root` and whatever it chains after the build, such as a formatter over
the written JSON. Otherwise run the launcher shipped beside this skill:

```bash
node scripts/build.mjs --root <plugin-root>
```

Resolve `scripts/build.mjs` against this skill's own directory. It runs the CLI that shipped beside
it, so nothing is downloaded and the build cannot resolve a different version from the one installed.
`npx universal-plugin plugin build` is the fallback. `--root` defaults to the working directory and
must name the directory that holds the canonical `plugin.json`.

The command never prompts, so it is safe to run unattended.

| Flag | Effect |
|---|---|
| `--dry-run` | Validate and report the plan, write nothing. Run this first when unsure what will change |
| `--vendor <id>` | Build one vendor (`claude-code`, `cursor`, `codex`, `copilot-cli`), and refresh only its catalog |
| `--check` | Write nothing; exit 1 if a committed governance copy differs from its source |
| `--verbose` | Print each field-level decision the derivation made |
| `--format json` | The same result as JSON, for scripts |

`--clean` also exists. It deletes derived manifests before rewriting them, so reach for it only
through `remove-plugin`.

## Step 2: Read the result

Default stdout is TOON: one row per vendor (`vendor, path, status`), one row per catalog
(`path, status`), and a precomputed summary. Read the rows; do not re-derive them.

| Vendor status | Meaning |
|---|---|
| `built` | the derived manifest or component tree was written |
| `canonical` | Copilot CLI with nothing to derive: root `plugin.json` serves it directly |
| `skipped` / `failed` | the row says why; fix that and rebuild |

A catalog row reads `updated`, `unchanged`, or `planned` on `--dry-run`. A build **never creates** a
catalog, and it keeps an entry's non-local source, such as an npm package, while it re-derives the
version. To add a catalog or change a source, use `marketplace`.

Read stderr too. The build drops what a vendor cannot represent and warns instead of failing: a hook
handler type a vendor cannot run, a `harnesses.copilot-cli` override with no delivery path, an
invalid catalog. Each warning names something that will not reach a runtime. Tell the user each
one; do not bury it in a summary.

`built 0` with "nothing to build" is not success. The manifest declares no vendor, so hand it to
`doctor-universal-plugin`, which the stderr line names.

## Step 3: Commit what was derived

Derived manifests and governance copies are committed with the change that caused them, because a
git-sourced install reads them straight from the repository. Stage the source change and its
derived files together:

```bash
git status --short
```

Expect the vendor manifests, `com.github.copilot/`, any refreshed catalog, and any rewritten
governance copy. A diff outside those paths did not come from the build.

## In CI

```bash
node scripts/build.mjs --check --root <plugin-root>
```

`--check` writes nothing, not even a manifest, and exits 1 naming each governance copy that has
drifted from the package that owns it, with `plugin build` as the fix. Gate a pull request on it,
the way this repository's `pnpm verify` does.

## Guards

Validation runs before the first write, so a failed build leaves the tree untouched.

| Message names | What it means | Do this |
|---|---|---|
| a missing `plugin.json` | `--root` is not the plugin root | point `--root` at the directory holding the canonical manifest |
| codex requires `description` / `version` | Codex rejects a manifest without them | add them to `plugin.json` through `init-universal-plugin`, or `version` for the number |
| a `--vendor` not among the targets | the manifest does not declare that vendor | declare it through `init-universal-plugin`, or drop the flag |
| `vendorExtensions` or `.plugin/plugin.json` | a pre-0.6 layout this CLI no longer reads | run `doctor-universal-plugin`, which names the migration |
| a governance no package owns, or a `SKILL.md` not listing its copy | a skill's `references/governances/` declares a copy the build cannot resolve | fix the file name, add the owning package, or list the copy under the skill's References |

## Do not

- **Hand-edit a derived file.** The next build overwrites it. Change `plugin.json` or the component
  source, then build.
- **Edit `plugin.json` to get a different derived manifest.** A per-vendor field belongs under
  `extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>`. That is a declaration, and
  `init-universal-plugin` owns it.
- **Expect a build to pin skill `npx` references.** That is the release-time `plugin bundle`, not
  this step.

## Related skills

| Task | Skill |
|------|-------|
| Change what the plugin declares | `init-universal-plugin` |
| Diagnose a build that derives nothing, or a runtime that loads nothing | `doctor-universal-plugin` |
| Move the version and rebuild in one step | `version` |
| Delete derived manifests or drop a vendor | `remove-plugin` |
| Create a catalog, or list a plugin with an npm source | `marketplace` |

## References

- Spec: [`plugin/build/`](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/plugin/build/README.md)
- [ADR-0014](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0014-build-refreshes-catalogs.md): the build refreshes catalogs it finds
- [ADR-0016](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0016-build-copies-governances-into-skills.md): the build copies governances into skills
