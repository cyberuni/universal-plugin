---
spec-type: behavioral
concept: [canonical-manifest, axi]
---

# plugin init — scaffold a plugin project, and wire an npm package to ship it

## What

`universal-plugin plugin init` sets up a plugin project: it writes the **canonical manifest** and,
on request, wires an npm package so the plugin's built artifacts travel with `npm publish`. It is the
entry point that produces the source-of-truth manifest the rest of the `plugin` group derives from.
Every command follows the AXI output contract ([../../axi/](../../axi/README.md)).

**Key terms**

- **Canonical manifest** — `plugin.json` at the project root, in Agent Plugins Specification v1.0.0
  form (ADR-0007). Its field set is **closed**: `$schema`, `name`, and the metadata fields, plus a
  single `extensions` object. Tool-specific data lives **only** under `extensions`, keyed by a
  reverse-domain namespace — `universal-plugin`'s own config lives at
  `extensions["org.cyberuni.universal-plugin"]`.
- **Derived vendor manifest** — a per-harness manifest `plugin build` generates from the canonical
  one, each at that harness's own path (e.g. `.claude-plugin/plugin.json` for Claude Code). These are
  build **outputs**, not authored here.
- **Ship on publish** — an npm package declares which files travel in its tarball via `package.json`
  `files`; `--npm` adds the derived vendor manifests and the skills directory to that list.

> **Distribution caveat.** Claude Code's **npm** plugin source is **not supported for
> organization-distributed (Team / Enterprise) marketplaces** — those support only `github`, `url`,
> and `git-subdir` sources (org sync reads the marketplace repo through the Claude GitHub / GHE App).
> `--npm` wires the package regardless; the limitation is the *consumer's* (public / personal
> distribution, or the relative-path-in-marketplace-repo workaround). Recorded so an author is not
> surprised — see `## References`.

**Non-goals** — deriving the vendor manifests (`plugin build`); checking a manifest
(`plugin validate`); pinning release versions (`plugin bundle`); **setting a repository up to
*consume* skills** — the canonical skills layout, per-harness compatibility links, and the
enabled-harness record are **`repobuddy/buddy-agent-harness`**'s, withdrawn from this package
(ADR-0006); publishing to or installing from a marketplace (`cyberplace`).

> **Spec-first / impl-deferred.** No `init` command ships yet (`src/cli.ts` registers no `init`,
> there is no `src/init/` domain). This node is a contract; the impl gate withholds certification
> until it is built.

## Use Cases

The entry points, each a mode of the `universal-plugin plugin init` verb, given as
**trigger / inputs / outcome**:

- **Scaffold the canonical manifest** — `plugin init [--name <n>] [--vendor <id>]… [--scaffold]
  [--force] [--yes]`.
  - *trigger:* an author starts (or re-scaffolds) a plugin project.
  - *inputs:* the flags above; the project root (`--root`, else cwd).
  - *outcome:* a root `plugin.json` written with a `name` and the closed metadata shape; optionally
    the standard directories; each `--vendor` recorded in the build-target list.
- **Wire an npm package to ship the plugin** — `plugin init --npm [--vendor <id>]… [--force]`.
  - *trigger:* an author wants the built vendor manifests to travel on `npm publish`.
  - *inputs:* an existing `package.json` at the root; the `--vendor` set (default `claude-code`).
  - *outcome:* the canonical manifest is written **and** `package.json` `files` carries each selected
    vendor's derived manifest path plus the skills directory; existing `files` entries and other
    fields are preserved; safe to re-run.
- **Print the command reference** — `plugin init --help`.
  - *trigger:* an author asks what the verb does.
  - *inputs:* none.
  - *outcome:* a synopsis, the flags, and one example on stdout; exit 0.

## Control Flow

All three use cases enter one graph; `--npm` adds the pre-flight guard and the wiring step, `--help`
short-circuits. Decisions are nodes, branches are edges.

```mermaid
graph TD
  A[plugin init invoked] --> UF{unknown flag?}
  UF -->|yes| E_UF[exit 1 · name the flag]
  UF -->|no| HELP{--help?}
  HELP -->|yes| E_HELP[print reference · exit 0]
  HELP -->|no| PRE{--npm and no package.json?}
  PRE -->|yes| E_PRE[exit 1 · name missing package.json · write nothing]
  PRE -->|no| EX{plugin.json exists and no --force?}
  EX -->|yes| E_EX[exit 1 · point at --force]
  EX -->|no| W[write root plugin.json]
  W --> NM{--name given?}
  NM -->|yes| nm1[name = --name]
  NM -->|no| nm2[name = root directory name]
  W --> VN{--vendor given?}
  VN -->|yes| vn1[record vendors in extensions org.cyberuni.universal-plugin]
  W --> SC{--scaffold?}
  SC -->|yes| sc1[create skills/ agents/ governances/ commands/]
  SC -->|no| sc2[manifest only]
  W --> NP{--npm?}
  NP -->|yes| wire[add each vendor's derived manifest path + skills/ to package.json files]
  NP -->|no| skip[package.json untouched]
  wire --> OUT
  skip --> OUT
  sc1 --> OUT
  sc2 --> OUT
  OUT[emit TOON/json result · stderr next-step → plugin build]
```

`init` never prompts, with or without `--yes` or `--format` — the "prompt?" decision is barred to
"no" on every path (AXI, ADR-0003). `--yes` is a compatibility no-op.

## Scenario map

Grouped by use case; 1:1 with [`init.feature`](./init.feature). `| Edge | Path (Given) | Scenario |`.

### Scaffold the canonical manifest

| Edge | Path (Given) | Scenario |
|---|---|---|
| write plugin.json | no manifest, defaults | `writes the canonical plugin.json with a name` |
| name = --name | `--name` given | `--name sets the plugin name` |
| name = dir | no `--name`, root named `cool-plugin` | `defaults the plugin name to the root directory name` |
| record vendors | `--vendor` given | `--vendor records the vendor in the universal-plugin extensions namespace` |
| create dirs | `--scaffold` | `--scaffold creates the standard directories` |
| manifest only | no `--scaffold` | `without --scaffold only the manifest is written` |
| guard: exists | manifest exists, no `--force` | `an existing manifest fails pointing at --force` |
| overwrite | manifest exists, `--force` | `--force overwrites the existing manifest` |
| prompt barred (convergence) | any of default / `--yes` / `--format json` | `init never prompts on any invocation` |
| TOON result | success, no `--format` | `a successful run prints a TOON row per file plus the created aggregate` |
| JSON result | `--format json` | `--format json returns the created array` |
| next-step | success | `a successful run ends with the plugin build next-step line` |
| guard: unknown flag | `--frobnicate` | `an unknown flag fails loud` |

### Wire an npm package to ship the plugin

| Edge | Path (Given) | Scenario |
|---|---|---|
| wire default vendor | `--npm`, package.json present, no `--vendor` | `--npm defaults to wiring the claude-code manifest path` |
| wire each vendor | `--npm --vendor claude-code --vendor cursor` | `--npm wires each named vendor's derived manifest path` |
| wire skills dir | `--npm` | `--npm wires the skills directory into files` |
| create files array | `--npm`, package.json without `files` | `--npm creates the files array when it is absent` |
| preserve others | `--npm`, package.json with `files` and `scripts` | `--npm preserves existing files entries and other fields` |
| idempotent re-run | `--npm --force` on already-wired package.json | `re-running --npm adds nothing new` |
| guard: no package.json | `--npm`, no package.json | `--npm with no package.json fails before writing the manifest` |
| barred: no --npm | package.json present, no `--npm` | `without --npm the package.json is untouched` |
| npm reports updated | `--npm` success | `--npm reports package.json as updated in the result` |

### Print the command reference

| Edge | Path (Given) | Scenario |
|---|---|---|
| help | `--help` | `--help prints a concise reference` |

## References

- Agent Plugins Specification v1.0.0 (`agent-plugins.org`) — backs the closed `plugin.json` field set
  and the `extensions` reverse-domain namespace this node scaffolds. Adoption recorded in ADR-0007.
- ADR-0006 (this project) — backs the scope: `plugin init --npm` (the publish half) stays; the
  consume half moves to `repobuddy/buddy-agent-harness`.
- [Claude Code — Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
  — backs the **Distribution caveat**: "Plugin sources of type `github`, `url`, and `git-subdir` are
  supported. `npm` and `archive` sources are not" for Team/Enterprise organization distribution
  (verified 2026-08-09).
