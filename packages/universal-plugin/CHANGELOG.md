# universal-plugin

## 0.6.0

### Minor Changes

- 4c15a40: New `universal-plugin marketplace validate` — check the catalogs a repository carries against the
  schema each runtime loads.
  
  A catalog is read at install time, in someone else's terminal, so a broken one is silent here and
  loud there. `validate` moves the refusal to the repository: per target it reports `valid`, `invalid`,
  or `missing` (`--required` makes missing a failure), exits 1 when any selected catalog is invalid, and
  names the key at fault plus the value to write instead — `owner must be an object with a name, not
  string`. The rules are the official Claude Code marketplace schema for Claude Code, Cursor, and
  Copilot CLI, and Codex's own document shape for Codex; a `./` source is also checked for existing on
  disk. Nothing is repaired or written.
  
  The same rules now run wherever a catalog is produced: `marketplace init` validates every planned
  artifact and fails before any write, while `plugin init` and `plugin build` — which fold one entry
  into a file they did not author — report the issues as notes and warnings.
  
  The `marketplace` skill gained the validation step and now refuses to hand-author a catalog.

### Patch Changes

- 4c15a40: Catalog entries now carry manifest metadata in the shape the catalog schema states.
  
  A `plugin.json` written from a `package.json` carries `repository` as `{ type, url }`, and every
  generated entry copied that object through. Claude Code refuses such a catalog —
  `plugins[0].repository: expected string` — so a repository could generate a catalog nobody could
  install from. An npm-shaped `repository` now becomes its URL, with any `git+` prefix removed, and a
  manifest field that cannot be reduced to the type the schema states is omitted rather than written.
- 4c15a40: `doctor` now reports a marketplace catalog its runtime would refuse.
  
  The catalogs sit at the repository root, above the plugin in a monorepo, and each is read at install
  time — so a broken one is silent in diagnosis and loud in a user's terminal. The new `invalid-catalog`
  finding names the key at fault and hands the repair to `/universal-plugin:marketplace`. A missing
  catalog is still not a fault.

## 0.5.0

### Minor Changes

- f3e6979: `plugin build` now keeps the repository's local marketplace catalogs true. Each build re-derives this
  plugin's entry in every catalog the repository already carries, for the vendors it is building, so a
  catalog entry's version follows the canonical manifest instead of drifting from it (ADR-0010 §3,
  ADR-0014). A version move reaches the catalogs in both release models with no extra command, since
  `plugin version` and `changeset version → publish sync-version` both end in `plugin build`.
  
  The refresh creates nothing: a catalog the repository does not carry is not written, and inside one
  it carries, only this plugin's entry changes — the catalog's own fields, its formatting, its
  indentation, and every other plugin's entry stay as they are. `--dry-run` reports the refresh as
  planned. The build output and its JSON gain a `catalogs` list.
  
  Neither generator requires a version on a Codex entry any more. `marketplace init --codex` used to
  fail and `plugin init --vendor codex` used to skip the catalog, both on the belief that Codex keys
  its install cache by the entry's version. It does not: the version comes from the plugin's own
  manifest, and an entry that declares none installs normally (verified against codex-cli 0.147.0,
  `.research/local-marketplaces`, E-CODEX-M15, E-CODEX-M16). The entry still carries the canonical
  manifest's version when there is one, because that is this project's policy.
- d73685a: `marketplace init` now writes Cursor the catalog it actually reads, and every catalog an `owner`
  object.
  
  Cursor's plugins reference documents `.cursor-plugin/marketplace.json` at the repository root, close
  to Claude Code's shape. This project's research had recorded the opposite, so `--cursor` produced a
  `.cursor-plugin/marketplace-submission.json` and a `CURSOR_MARKETPLACE_SUBMISSION.md` handoff. Both
  are gone, replaced by the catalog. Cursor also joins the default target set, and the
  `skipped-default` status it carried no longer exists.
  
  `owner` was emitted as a string, which Claude Code rejects: `claude plugin validate` reports
  `owner: Invalid input: expected object, received string`. It is now an object carrying `name`, plus
  `email` and `url` when the canonical manifest's `author` supplies them. The Claude catalog also
  carries a `$schema` key for editor completion and validation.
- 620f2d0: `plugin build` now translates hooks per vendor instead of copying the canonical declaration through
  unchanged. Cursor gets a derived `hooks.json` beside its manifest with camelCase event names, the
  schema version it expects, and matcher groups flattened into its handler list; Claude Code, Codex,
  and Copilot CLI read the canonical PascalCase file as authored.
  
  A handler the target vendor cannot run — `http` on Cursor, anything but `command` on Codex, `agent`
  on Copilot CLI — is dropped from that vendor's file and warned about, one warning per event and
  handler type, and the build stays green (ADR-0011). A vendor left with no runnable hook at all gets
  no derived file and no `hooks` field.
- d73685a: `plugin init --vendor <id>` now registers the plugin in the repository's local marketplace, writing
  each selected vendor's catalog at the repository root — `.claude-plugin/marketplace.json`,
  `.cursor-plugin/marketplace.json`, and the rest — so the plugin can be installed and tested before
  it is published. `--no-marketplace` opts out.
  
  The marketplace is named after the repository rather than the plugin, `<owner>-<repo>-local`, since
  the catalog sits at the repository root and lists every plugin the repository develops. The entry's
  `source` is the path from there to the plugin. Owner comes from the canonical manifest's author, the
  package that ships it, or the account the repository lives under; without one there is no catalog,
  because every runtime requires it.
  
  Re-running `init` folds the entry into the catalogs already on disk: the marketplace name, the
  owner, and every other plugin's entry stay as they are. The entry's `version` is derived from the
  canonical manifest, never authored, and a version left on an entry whose manifest declares none is
  removed (ADR-0010 §3). A Codex entry is written whether or not there is a version to derive:
  Codex caches a local install under the version the plugin's own manifest carries, never the entry's.
- 37ae40f: Add a `marketplace` skill: generate the repository's own marketplace catalogs, then write the README install section.
  
  `marketplace init` has shipped for a while with no skill in front of it, so nothing surfaced it to an agent. The skill picks targets with the user, runs the generation, verifies it, and offers the install documentation that goes with it.
  
  The install commands were verified by running the CLIs, because the documentation is incomplete and a third-party README was the alternative source:
  
  - **Claude Code, Codex, and Copilot CLI each install from a catalog the repository carries.** Each reads its own path, and all three read `.claude-plugin/marketplace.json`, so one file covers them when a repository wants fewer.
  - **Codex's marketplace verbs exist but are undocumented.** `codex plugin marketplace add` and `codex plugin add` ship in codex-cli 0.147.0 and appear in no vendor page. Codex installs with `plugin add` where Copilot CLI uses `plugin install`.
  - **Codex discovers a catalog by the filename `marketplace.json`** inside a supported directory. `.claude-plugin/` and `.agents/plugins/` are read; `.codex-plugin/`, `.plugin/`, `.github/plugin/`, and the repository root are not.
  - **A shared catalog must carry `owner`.** Claude Code rejects one without it; Codex does not require it and tolerates extra fields, so the Claude shape is the portable one.
  - **Cursor has no repository-local marketplace.** The `--cursor` output is a submission handoff, and `cursor-agent` has no plugin subcommand.
  
  `references/runtimes.md` is the only source of install commands, and every entry carries an evidence ID from `.research/local-marketplaces/`. The skill also documents the Codex local-development loop, where an install is cached by plugin version and a source edit needs a reinstall and a new session.
  
  `scripts/install-docs.mjs` derives the README section from the catalogs on disk, so the marketplace name, plugin names, and repository slug come from the repository. It emits JSON and writes nothing; the skill asks before editing the README.
- aad26dd: Declare plugin dependencies once, and let the build deliver them per vendor. A plugin says what it
  needs under `extensions["org.cyberuni.universal-plugin"].dependencies` — an array of plugin names,
  each optionally `@marketplace`-qualified or given as an object with a semver range or a commit sha.
  Claude Code is the only runtime that reads a dependency, so its manifest carries the declaration and
  the others are built without it, each drop named in a warning. The build stays green. A range written
  into the string form is accepted by the runtime and then discarded, so the build warns once and names
  the object form that is enforced (ADR-0013).
- f6bf784: Add `plugin install` and `plugin uninstall` — put the plugin under development into a runtime, instead of hand-writing a symlink.
  
  Getting a working copy into a runtime meant a symlink per vendor, copy-pasted into every plugin repository's readme. Re-verifying that recipe against the shipped runtimes found both halves wrong: `~/.claude/plugins/local/` does not exist in Claude Code — the path that works is its skills directory, which adopts a plugin and loads it as `<name>@skills-dir` — and Cursor's `~/.cursor/plugins/local/` resolves each symlink and refuses a target outside itself. An author following those two lines got silence from both runtimes and no way to tell why.
  
  `plugin install` installs into every vendor the canonical manifest already declares, `--vendor <id>` narrows it, and `--list` shows the resolved destinations without writing. Each vendor's local plugin directory now lives in the vendor registry alongside every other vendor path this tool knows, so a vendor moving its directory is one line here rather than a stale command in every downstream readme — and a machine with a runtime configured elsewhere can override it in `~/.agents/universal-plugin-vendors.json`.
  
  The mode resolves per vendor, because a single default cannot serve both runtimes: it links where the vendor follows an out-of-tree symlink and copies where it does not, and the result row names the mode each vendor got. `--copy` forces a snapshot everywhere; `--link` forces a link and fails a vendor that will not load one, rather than quietly copying when a live link was asked for. Codex and Copilot CLI scan no local directory at all and report as `unsupported`, with their marketplace route named.
  
  Re-running replaces this plugin's own earlier install rather than stacking; a destination another plugin owns is refused until `--force`. `plugin uninstall` applies the same ownership test, and reports a destination that was never installed rather than failing. Both refuse to run against a vendor whose derived manifest was never built, pointing at `plugin build`.
  
  Recorded as ADR-0012, with the verified per-runtime facts and their confidence in `.research/local-marketplaces/`.
- 50a9c82: Record the version policy as ADR-0010, and give `doctor` the check it obliges.
  
  The canonical `plugin.json` owns a plugin's version; every other version-carrying artifact — the per-vendor manifests, the repository-local marketplace catalogs, the `npx`/`upx` pins in `skills/**` — derives from it and is never authored by hand. Who picks the next value splits on `packagePath`: without one the author picks, through `plugin version <bump>`; with one the release picks, and `publish sync-version` carries the number from `package.json` into the manifest.
  
  A marketplace entry's version is copied from the canonical manifest of the plugin its `source` resolves to. Where a runtime lets both the entry and the manifest carry one, the manifest wins — Claude Code documents that it overrides the entry silently — so a generated entry is never the number that decides anything, and never a number a human edits.
  
  `doctor` gains `unreleased-content`. A runtime keys its plugin cache on the version, so content committed after the commit that set the current one never reaches a consumer who already installed the plugin, and neither side is told: the author sees a successful push, the consumer sees "already at the latest version". The check compares the shipped paths against that commit. It stays quiet on uncommitted work, on a plugin that declares `packagePath` — there the release picks the number — and on a tree with no git history. Alongside it, `doctor` now reads `packagePath` from `.agents/universal-plugin.json`, where the CLI reads it, so `version-drift` fires for the repositories that actually declare one.

### Patch Changes

- d998e13: Resolve `--root` to an absolute directory, and stop re-joining a workspace-relative root onto a cwd already inside it
  
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

## 0.4.0

### Minor Changes

- 0d9136b: Replace the `plugin` gateway skill with four verb-shaped skills: `init`, `doctor`, `version`, and `remove-plugin`.
  
  The gateway routed six operations behind one name, and no single name covers that set. `init` reads as first-time setup, which is wrong for deleting a manifest; `plugin` is a noun that says what the skill is about and never what it does. One description that has to trigger on "convert this to the open standard", "bump the version", and "delete the generated manifests" is a weaker match for each than three focused ones.
  
  Each skill is now scoped by the object it touches, which is also what keeps them from competing for the same asks:
  
  - **`init`** — the manifest's declaration: create, adopt, update. Runs five phases (survey, classify, confirm, apply, verify), where confirm is the gate the old gateway lacked: adoption turns files the user maintains into build output, and that needed approval it never asked for.
  - **`doctor`** — read-only diagnosis. Reports what is declared, unbuilt, stale, hand-edited, drifting, or shadowing, and hands every repair to the skill that owns it.
  - **`version`** — the released number, in both release models: changesets-decided and carried in by `publish sync-version`, or moved directly by `plugin version`.
  - **`remove-plugin`** — the artifacts: derived manifests, a stale `.github/plugin/plugin.json`, a shadowing `.plugin/plugin.json`, or the whole plugin behind a confirmation.
  
  Also in this change:
  
  - `scripts/init.mjs` and `scripts/version.mjs` run their CLI verb from the copy shipped beside the skill, so neither a scaffold nor a release number needs a network fetch.
  - `doctor` ships `scripts/doctor.mjs`: it composes `plugin build --dry-run --format json` with the filesystem facts build cannot see — missing and stale derived manifests, a shadowing `.plugin/plugin.json`, version drift between the two authored numbers — and emits one JSON object. It stays a thin composition so it folds into `plugin validate` when that command lands, rather than competing with it.
  - Each skill carries a README.
  - One reference per vendor, read only when that vendor is enabled, replacing the vendor columns the create reference carried inline.
  - A frontmatter reference documenting `invocation-policy`, including the part that surprises people: the build rewrites the authored `SKILL.md` to carry the derived flags.
  - The create reference no longer claims `plugin build` is unavailable — it has shipped, and the reference now names its flags and the warnings worth reading.
  - The vendor references state plainly that the build does not translate hook event names across the PascalCase/camelCase divide, which it does not (tracked in #41).
  
  ADR-0009 records the split and supersedes the single-gateway reach rule in `spec.md` and `plugin/version/`.
- 4e0e5ee: Emit TOON as the default output format
  
  Every command's `--format` help named `toon` as its default, and the AXI output
  contract (ADR-0003) requires it, but the implementation printed aligned ASCII
  tables and padded field lists. Commands now encode their result with
  `@toon-format/toon`, so `plugin build`, `plugin init`, `plugin version`,
  `plugin bundle`, `config add`, `config get`, `governance list`,
  `marketplace init`, and `publish sync-version` emit parseable TOON on stdout.
  
  `--format json` is unchanged. `governance show` still prints the document body,
  which is text rather than a record. Each default payload keeps its minimal row
  schema and its pre-computed aggregate summary, so the counts a script matched
  before are still there.

### Patch Changes

- a7fa800: Document how a skill runs a CLI its own plugin ships.
  
  The npx-and-upx page already named importing in-process as the only complete fix for the runner's cost, and put it at the top of the "choosing a runner" table. It did not say how a skill reaches that code when the skill file and the package both sit in a plugin cache.
  
  It now records the launcher pattern: a script in the skill's own `scripts/` directory that resolves the package from `import.meta.url` and imports the bin, invoked as `node scripts/<name>.mjs`. Four requirements come with it, each with its own failure mode: resolve from the script rather than the working directory, keep `node` in front of a file that ships without an executable bit, publish to npm when the CLI has dependencies, and keep a pinned `npx` fallback that is regenerated at release.
- dda4bca: Ship the MIT license file in the package
  
  `package.json` and `plugin.json` both declared `"license": "MIT"`, but no license
  file existed, so the published tarball carried the declaration without the terms
  and the readme's license link pointed at a file that was never there.

## 0.3.1

### Patch Changes

- b0da34d: Stop deriving `.cursor/commands/*.md` mirrors of skills
  
  The build wrote a copy of every user-invocable skill body to
  `<root>/.cursor/commands/<name>.md`. Cursor does not need it: a plugin's
  `skills` path is loaded directly, and a user invokes a skill by typing `/` and
  searching for it. Cursor also expresses explicit-only invocation natively with
  `disable-model-invocation`, which the build already writes into SKILL.md — so the
  mirror was a redundant second copy of the same content, dropped into the plugin's
  own working tree.
- 13879cc: Derive universal-plugin's own vendor manifests instead of hand-maintaining them
  
  The package shipped `.claude-plugin/`, `.cursor-plugin/`, and `.codex-plugin/`
  manifests that were written by hand and never regenerated, because the canonical
  `plugin.json` declared no `harnesses`. They had drifted to `version` `0.2.0` and
  still carried the retired `vendors` and a `assets` path pointing at a directory
  that does not exist — so every runtime reading a vendor manifest saw a stale
  version. Declaring the four harnesses lets `universal-plugin plugin build`
  produce them, and the regenerated files now track the canonical version.
- 7c026fb: Regenerate the vendor manifests during `changeset version`
  
  The release chain synced the canonical `plugin.json` and stopped there —
  `publish sync-version` writes exactly one row, so `.claude-plugin/`,
  `.cursor-plugin/`, and `.codex-plugin/` kept whatever version they were last
  committed with. The repo's own manifests had drifted a full minor behind as a
  result. The root `version` script now runs `plugin:build` after the sync, so
  every release derives the vendor manifests from the freshly synced version.

## 0.3.0

### Minor Changes

- e9a31ce: Add `universal-plugin marketplace init` for deterministic repository-local marketplace metadata.
- 8fb8297: `plugin build` no longer derives a manifest for `copilot-cli`. Copilot CLI searches
  `.plugin/plugin.json` → `plugin.json` → `.github/plugin/plugin.json` → `.claude-plugin/plugin.json`
  and takes the first match, so the canonical root `plugin.json` always shadowed the
  `.github/plugin/plugin.json` we were emitting — that file was never read. Copilot CLI has consumed
  Open Plugin Spec v1 manifests since v1.0.74, so the canonical manifest serves it directly. The
  vendor is now reported with status `canonical`, and a `harnesses["copilot-cli"]` override warns that
  it has no delivery path (the canonical schema is closed to vendor-only fields).
  
  Delete any stale `.github/plugin/plugin.json` from a previous build; it was inert.
- 8dfffbd: Derive vendor slash-command artifacts from skill invocation policies.
- b50b9c8: The `plugin` skill now detects existing plugins on invocation. When a project has a vendor-specific
  manifest (`.claude-plugin/`, `.cursor-plugin/`, …) or already ships public skills but has no
  canonical root `plugin.json`, the gateway offers to adopt the open Agent Plugins Specification. The
  lossless conversion procedure lives in the new `references/adopt.md`. Repo-private agent config
  (`.claude/skills/`, `.agents/skills/`) is excluded from detection.
- ab6ff25: New `universal-plugin plugin version <major|minor|patch|premajor|preminor|prepatch|prerelease|x.y.z>`
  moves a plugin's version. A version lives in up to five places, but only two of them are
  **authored**: the canonical root `plugin.json` and, when `.agents/universal-plugin.json` declares a
  `packagePath`, that `package.json`. The rest — the per-vendor manifests, the local marketplace
  catalogs, and the `npx`/`upx` pins in `skills/**` — are **derived** by commands that already exist.
  So the verb writes the authored pair and then calls `plugin build`'s own writer to re-derive, rather
  than becoming a second writer for files `build` owns.
  
  `--preid <id>` picks the prerelease identifier, `--force` allows a version that does not advance,
  `--no-build` skips re-derivation, and `--dry-run` reports the plan without writing. Every guard —
  missing manifest, a relative bump with no current version, an unknown bump argument, a
  non-advancing target, a declared `packagePath` whose `package.json` is absent — fails loud and
  leaves the tree untouched.
  
  `publish sync-version` keeps the opposite direction (a changesets-decided number flowing
  `package.json` → manifest) with its behavior unchanged, but now shares the new applier so the two
  directions cannot drift apart.
  
  The shipped `plugin` gateway skill gains a matching route — `references/version.md` — so an agent
  asked to bump a plugin's version finds the verb instead of hand-editing a `version` field. Its
  route table previously covered create / adopt / inspect / update / delete, none of which is moving
  the version. The skill description now names the version triggers explicitly, and the reference
  routes changesets repos to `publish sync-version` rather than to the new verb.
- 36d05fc: Shorten the bundled skill names by dropping the redundant `universal-plugin` half — the plugin
  namespace already supplies it. `universal-plugin` → `plugin`, `publish-universal-plugin` →
  `publish-plugin`, `upgrade-universal-plugin` → `upgrade-plugin`, `migrate-universal-plugin` →
  `migrate-plugin`. Invocation becomes `/universal-plugin:plugin` instead of
  `/universal-plugin:universal-plugin`. `adopt-upx` is unchanged.
  
  **Breaking for name-pinned installs.** Installing the whole plugin is unaffected — the marketplace
  entry resolves the package directory and discovers skills from `skills/`, so nothing there refers to
  a skill by name. But a per-skill install pinned the old name, and that path is gone:
  
  ```bash
  # before
  npx skills add cyberuni/universal-plugin --skill upgrade-universal-plugin
  # after
  npx skills add cyberuni/universal-plugin --skill upgrade-plugin
  ```
  
  Update the `skills` key and `source` path in your `skills-lock.json`, or re-run `skills add` with the
  new name. No aliases are shipped for the old names.
- e2a57e1: Add `upx`, a local-first package runner, as a second lean bin.
  
  `upx <pkg>@<range> [args…]` resolves the requested semver range against installed packages —
  walking `node_modules` from the cwd up through its ancestors (nearest wins), then the global
  `npm root -g` store — and spawns the matching binary directly, roughly 10× faster than `npx`
  (which pays ~1s of registry resolution per call even when cached). On a miss it falls back to
  `npx` with the spec exactly as given, printing a one-line stderr notice. It is a transparent
  exec wrapper: the child owns stdout/stderr and its exit code; `upx` installs nothing and writes
  nothing to `node_modules` or the global store. A dist-tag (`pkg@next`) goes straight to `npx`.
  
  Also adds `plugin bundle --runner <npx|upx>`: omitting it preserves each skill reference's
  existing runner word while re-pinning the version; `--runner upx` opts a release into emitting
  `upx` references.

### Patch Changes

- d28501c: Synchronize local Codex marketplace entry versions with canonical plugin manifests.
- df326ae: `plugin init --npm` now always wires the open-standard base — the canonical root `plugin.json` and
  `skills/` — into `package.json` `files`, whatever `--vendor` targets are named. Previously the base
  was tied to vendor selection, so a default `--npm` run wired `.claude-plugin/plugin.json` and
  `skills/` but never the canonical manifest, and the published package shipped a Claude Code plugin
  rather than a standard one. Vendor-derived manifests are added on top of the base, never in place
  of it.
- 454267e: Restructure the `plugin` skill as a gateway. The Create, Inspect, Update, and Delete procedures
  moved out of `SKILL.md` into `references/create.md`, `references/inspect.md`,
  `references/update.md`, and `references/delete.md`. `SKILL.md` now carries only the trigger,
  prerequisites, and a routing table, so an agent loads one operation's procedure instead of all four.

## 0.2.1

### Patch Changes

- 7c92d8e: Mark the CLI bin shim as executable so it runs directly after install.

## 0.2.0

### Minor Changes

- c6bc08a: Add `publish sync-version` command to sync the `version` field in `.plugin/plugin.json` from the npm package declared by a new `packagePath` field. Run `universal-plugin publish sync-version` after `changeset version` to keep the plugin manifest version in sync with the npm package. Also fixes the `build` command to strip `packagePath` from generated vendor manifests.
- 1100fa3: Add initial `universal-plugin` CLI with cross-vendor plugin management commands.

  New commands:
  - `prepare` — diffs the current vendor's installed plugins against the last snapshot and writes pending cross-vendor sync actions to state.
  - `sync apply <actionId>` — executes a pending install, update, or remove action using the target vendor's registered CLI command (or emits a manual instruction when none is configured).
  - `governance show <name>` / `governance list` — resolves and displays governance files by scope (global → project).
  - `asset-store` — manages the local store of downloaded plugin assets.
  - `self-update` — rewrites `universal-plugin` version pins in hook files when a newer version is detected.
  - `clean` — removes the local asset store directory.

  Supporting modules added: state file schema with tolerant reader and mutation helpers, vendor registry with bundled defaults and user-override support, source registry with store-path derivation for npm / GitHub / GitLab / URL sources.
