---
cr: github-32
status: active
todos:
  - content: "Spec: scaffold plugin/version/ node (README use cases -> control flow -> scenario map) + version.feature; register in root spec.md capability map + placement map"
    status: completed
  - content: "Spec gate: freeze version.feature, ledger gate line, status stays implemented on root spec"
    status: completed
  - content: "Impl: src/version/{version,fs,cli}.ts — planVersion domain + applier; wire `plugin version` into the plugin group"
    status: completed
  - content: "Impl: refactor publish/sync-version onto the shared applier (one writer, no forked code path); its observable behavior is unchanged"
    status: completed
  - content: "Tests: version.test.ts (domain guards + bump math + indent preservation) and cli.test.mts (end-to-end sync across manifest, package.json, derived vendor manifests)"
    status: completed
  - content: "Skill question: record the verdict + rationale (ADR or node README section)"
    status: completed
  - content: "Impl gate: pnpm verify green, per-scenario verification"
    status: completed
  - content: "Handoff: changeset, PR referencing Closes #32, combat log"
    status: completed
---

# github-32 — `plugin version`: bump the canonical manifest and every version-carrying file

CR: https://github.com/cyberuni/universal-plugin/issues/32
Related: #31 (version *policy* — out of scope here), #1 (closed; its "rewrite every plugin.json"
sketch predates ADR-0007, under which the vendor manifests are derived, not authored).

## Settled design

A plugin's version lives in five places; only **two are authored**:

| File | Authored / derived | Written by |
|---|---|---|
| `plugin.json` (canonical, root) | authored — source of truth (ADR-0007) | the author |
| `<packagePath>/package.json` | authored — npm's number | the author / changesets |
| `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/plugin.json` | derived | `plugin build` |
| marketplace catalogs | derived | `marketplace init` |
| `npx`/`upx <cli>@<version>` pins in `skills/**/SKILL.md` | derived | `plugin bundle` |

So the verb moves the two authored numbers together and then **re-derives via the existing `build`
writer** — it never writes a derived manifest itself (that would fork a second writer beside
`plugin build` and drift from it).

`universal-plugin plugin version <major|minor|patch|premajor|preminor|prepatch|prerelease|x.y.z>`
— a behavioral unit node at `plugin/version/`. Object = the canonical manifest, so it passes
ADR-0006's shared-object charter test.

- `--preid <id>` for prerelease identifiers, `--force` for a non-advancing target, `--no-build` to
  skip re-derivation, `--dry-run`.
- Guards (fail loud, write nothing): no canonical manifest; relative bump with no current version;
  invalid version / release type; target not greater than current; `packagePath` set but its
  `package.json` missing.
- `publish sync-version` keeps the opposite direction (changesets decides, package.json ->
  manifest), refactored onto the **same applier** so the two cannot drift. Behavior unchanged.

## Skill verdict

**No companion skill.** Recorded with its rationale in the node README's `## The skill question`.
Once the release type is named, the new version, the files to write, and the re-derivation are all
fully determined — nothing is left for an agent to judge. The one judged step, *which* release type
a change deserves, is changelog craft that changesets already owns and that composes with the verb
through `publish sync-version`.

## NEXT

Landed. `plugin/version/` is specced, frozen, implemented, and covered — 29 frozen scenarios, each
with a named test against the compiled binary; package verify green at 395 tests. Nothing remains.
