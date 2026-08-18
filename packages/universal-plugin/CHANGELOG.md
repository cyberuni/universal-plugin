# universal-plugin

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
