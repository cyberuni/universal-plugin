---
spec-type: behavioral
concept: [canonical-manifest, axi]
---

# plugin build — derive per-vendor manifests

`universal-plugin plugin build` compiles the canonical root `plugin.json` (Agent Plugins Specification
v1.0.0 form) into one vendor-specific manifest per target vendor. Each vendor expects its manifest at
a different path and shape; maintaining one file per vendor lets shared fields drift. Build treats the
canonical manifest as the single source of truth and generates the rest, merging each vendor's
`extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` fields over the shared metadata and
component paths (harness wins on conflict). The canonical wrapper (`$schema`, `extensions`) and
`universal-plugin`'s own orchestration keys (`vendors`, `packagePath`, `harnesses`) never appear in a
derived manifest.

Build is the **dev-consumable** derivation — it runs constantly while authoring a plugin, is
deterministic, and needs no network. Producing the **release form** — pinning the `npx <cli>@<version>`
references a plugin's skills carry to the versions being shipped — is a separate release-time step that
lives in [`plugin bundle`](../bundle/README.md), not here (root `spec.md` placement map). Build does
not touch skill pins. The one version pin build *does* stamp is a different object: a package
specifier inside an `mcpServers` entry's `args`, which is manifest content build already derives —
authored abstractly with a marker, stamped concretely here, exactly as hook casing is.

Follows the AXI output contract ([../../axi/](../../axi/README.md)).

## Use Cases

**Subject** — deriving vendor manifests from one canonical manifest, output per the AXI contract:

- **Target selection = `vendors ?? harnesses` keys** — with no filter, `plugin build` derives the
  `extensions["org.cyberuni.universal-plugin"].vendors` list when it is present, and otherwise falls
  back to every key declared in `harnesses`. Each target writes to its own path (`claude-code` →
  `.claude-plugin/plugin.json`, `cursor` → `.cursor-plugin/plugin.json`, `codex` →
  `.codex-plugin/plugin.json`).
- **`copilot-cli` derives components, not a manifest** — Copilot CLI searches `.plugin/plugin.json`
  → `plugin.json` → `.github/plugin/plugin.json` → `.claude-plugin/plugin.json` and takes the
  **first** match, so root `plugin.json` always shadows the lower two. Since Copilot CLI has consumed
  Open Plugin Spec v1 manifests since v1.0.74, the canonical manifest serves it as-is and no vendor
  manifest is derived. A `harnesses.copilot-cli` override therefore still has no delivery path — the
  canonical manifest's schema is closed — so the build warns rather than dropping it silently.
  Its **components** are a different answer ([ADR-0015](../../design/decisions/0015-copilot-spec-mode-namespace.md)):
  declaring the canonical `$schema` puts the plugin in Copilot CLI's spec mode, which reads agents,
  commands, rules, `hooks/hooks.json` and `lsp.json` **only** under `com.github.copilot/` and no
  longer from the plugin root. The build derives that tree from the canonical component paths — the
  files are copied — with agents renamed to Copilot CLI's `.agent.md` convention, since the canonical
  `agents/` is the Claude Code-shaped `*.md` and a file under the other name is ignored; commands and
  rules keep their authored names, the runtime documenting no extension for either — the hooks file is
  translated, and a declared `lspServers` **path** is copied to
  `com.github.copilot/lsp.json` — and reports the vendor `built` at `com.github.copilot/`. An
  **inline** `lspServers` map is not delivered: composing the file would mean guessing a top-level
  shape the runtime does not document, so it warns instead. `skills/` and `mcp.json` do not move and are not copied there. A plugin that
  declares none of the moving kinds has nothing to derive and is still reported `canonical` at
  `plugin.json`.
- **The namespace's component paths follow the same `pathValue` contract as `skills`** — `agents`,
  `commands` and `rules` resolve from a path string, a path array, or a `{ "paths": [...] }` object,
  and every declared directory is copied. Each carries the schema's default (`./agents/`,
  `./commands/`, `./rules/`), and the default means what an undeclared field means: it is read when
  the field is absent, and its being absent on disk is not a warning. A **declared** directory that
  does not exist **is** warned about, naming the path — the same asymmetry `skills` follows, for the
  same reason: a declared path that did not resolve is a loss the author can fix, and an unused
  default is not. A declaration in none of the three forms warns and copies nothing. `lspServers`
  resolves the same way, except that it names a file rather than a directory.
- **`com.github.copilot/extensions/` is authored, never derived** — Copilot's canvas extensions have
  no canonical root location to derive from, so an author writes them under the namespace directly.
  The build leaves the directory exactly as authored: it is neither written nor removed by `--clean`,
  and its presence alone does not make the vendor `built`.
- **Hooks are translated, not copied** — the canonical `hooks` declaration (a path, a path list, or
  an inline block) is read and derived per vendor. Claude Code and Codex read the canonical
  PascalCase event names and matcher-group shape; Cursor reads camelCase events, a top-level
  `version: 1`, and a flat handler list where each handler carries its own matcher; Copilot CLI
  accepts the canonical PascalCase as its Claude-compatible payload format. A vendor whose form
  matches the canonical file keeps pointing at it and gets no derived file; a vendor whose form
  differs gets `<vendor-dir>/hooks.json` beside its manifest, and its `hooks` field points there.
  `copilot-cli` has no manifest to repoint, so its translated file lands at the fixed spec-mode path
  `com.github.copilot/hooks/hooks.json`.
- **A handler the vendor cannot run is dropped with a warning** ([ADR-0011](../../design/decisions/0011-warn-and-drop-unrepresentable-hook-handlers.md))
  — Claude Code runs all four canonical handler types, Codex runs `command` only, Cursor runs
  `command` and `prompt`, Copilot CLI runs `command`, `http`, and `prompt`. Each drop warns, naming
  the vendor, the event, and the type; the build stays green. An emptied matcher group, event, or
  file is omitted rather than written empty, and a vendor left with no hooks at all carries no
  `hooks` field. Copilot CLI is derived for like any other vendor
  ([ADR-0015](../../design/decisions/0015-copilot-spec-mode-namespace.md) revises
  [ADR-0011](../../design/decisions/0011-warn-and-drop-unrepresentable-hook-handlers.md) §3 on this
  point): a handler it cannot run is dropped from its derived file with the same warning, not left in
  place and reported as ignored at runtime.
- **Component paths follow the extension's `pathValue` contract** — every path-typed field in
  `extensions["org.cyberuni.universal-plugin"]` is a single `./` path string, an array of those
  strings, or a `{ "paths": [...] }` object. Build reads `skills` (to derive each vendor's skill
  artifacts), so it resolves all three forms and discovers `SKILL.md` under **every** declared
  directory. `./skills/` is the fallback for a namespace that declares **no** skills path — never a
  substitute for a declared one the build failed to read. A declared directory that does not exist
  warns, naming the path; the undeclared default being absent does not. A declaration in none of
  the three forms warns and reads no skills, rather than falling through to the default.
- **An MCP invocation is pinned only on an explicit marker** — a plugin whose MCP server is its own
  npm package writes `{"command": "npx", "args": ["-y", "<pkg>", "mcp"]}`, and nothing pins it: a
  consumer on 1.4.0 gets 1.4.0's skills and whatever `npx` resolves as latest for the server. The
  version is known at build time and nowhere else — `mcp.json` expands only `${PLUGIN_ROOT}` and
  `${PLUGIN_DATA}`, so a runtime placeholder would arrive at the client literally. An `mcpServers`
  entry therefore opts in with `"pinToPluginVersion": true`, and the build rewrites that entry's
  package specifier in `args` to `<pkg>@<manifest version>`. The specifier is the **first argument
  that is not a runner flag** (`-y`, `--yes`), so an `args` list that omits the flag entirely is
  located the same way; every other argument is carried through exactly as authored. The marker is required and a name match
  is never used — a plugin may publish its server under a package name that is not the plugin's, and
  `npx -y widget-cli` must not be stamped with this plugin's version. An **already-pinned**
  specifier is **overwritten**, warning when the authored version differs: the marker declares that
  this package's version *is* the plugin's, and a version that is derived is never also authored
  ([ADR-0010](../../design/decisions/0010-version-policy.md) §1, whose derived-artifact table carries
  this pin). Each guard warns and leaves the
  entry untouched rather than failing the build: a `command` that is not `npx`/`upx`, a manifest with
  no `version`, or `args` carrying no package specifier.
- **The marker never reaches a vendor** — `pinToPluginVersion` is a build directive, not part of any
  vendor's schema, so it is stripped from every derived manifest and derived MCP file. Delivery
  follows the hooks rule: with no entry marked, the canonical `mcpServers` declaration passes through
  as authored and nothing is derived; with an entry marked, the pinned, marker-stripped servers map
  is delivered — inline when the canonical declared it inline, else as `<vendor-dir>/mcp.json` with
  the vendor's `mcpServers` field repointed there. The authored `mcp.json` is never rewritten.
  `copilot-cli` reads the canonical manifest directly, so there is no derived manifest to repoint, and
  `mcp.json` is not one of the paths its spec mode moves, so there is no derived file to deliver
  either. The build warns that the pin is not delivered, the same remedy
  [ADR-0011](../../design/decisions/0011-warn-and-drop-unrepresentable-hook-handlers.md) uses for a
  handler the vendor cannot run.
- **Merge then strip** — per-harness fields from `harnesses.<vendor>` are merged over the shared
  metadata and component paths; the canonical wrapper (`$schema`, `extensions`) and the orchestration
  keys (`vendors`, `packagePath`, `harnesses`) never appear in output.
- **`--vendor` filters** — restricts the build to one selected vendor; a vendor not among the
  selected targets fails.
- **Validation is eager** — the manifest is validated before any file is written; codex requires
  `description` and `version`; a failure writes nothing and exits non-zero. A missing root
  `plugin.json` fails.
- **Unknown vendors warn, not error** — an unknown vendor key in `harnesses` is warned and
  skipped; no targets at all is a definitive empty state — exit 0, zero built rows.
- **`--dry-run` / `--clean`** — `--dry-run` resolves and validates but writes nothing; `--clean`
  removes an existing output file before rewriting it.
- **Repository catalog entries are refreshed, never created** — a catalog entry's `version` is copied
  from the canonical manifest and never authored ([ADR-0010](../../design/decisions/0010-version-policy.md) §3),
  so the build that derives the manifests also re-derives this plugin's entry in each
  repository-local marketplace catalog the repository **already carries**, for the vendors being
  built. Every other field of that catalog and every other plugin's entry stay as they are, and a
  catalog the repository does not carry is not created — that choice belongs to `plugin init --vendor`
  and `marketplace init`. Outside a repository there is nothing to refresh. `--dry-run` reports the
  refresh as planned and writes nothing.
- **TOON by default, `--format json` escape hatch** — a successful build prints a TOON result to
  stdout, one row per vendor (`vendor, path, status`), plus a pre-computed aggregate summary
  (`built N, skipped M, failed K`, with `served by plugin.json N` appended when any vendor is
  `canonical`); `--format json` returns the same shape as structured JSON;
  `--format toon` names the default explicitly.
- **Definitive empty state** — no targets at all (neither `vendors` nor `harnesses`) still emits a
  TOON result on stdout (zero built rows, aggregate `built 0`) with exit 0, plus "nothing to build" on
  stderr. Because deriving nothing is the one result an agent is most likely to read as success, that
  stderr line also names `/universal-plugin:doctor` as the next step — the skill that can say *why*
  nothing was declared.
- **A declaration this CLI no longer reads is a failure, not an empty result** — a repository left on
  the pre-0.6 manifest layout derives nothing for a different reason. Its manifest parses; what it
  declares just sits somewhere this CLI no longer looks, so the declaration is dropped on the way in.
  A dropped read reported as `built 0` is a lost declaration wearing the costume of an honest zero,
  so it is an error (AXI #6), not a definitive empty state (AXI #5).
  When the target set resolves to zero **and** the project carries a pre-0.6 signal — a top-level
  `vendorExtensions` block in the root manifest, or a `.plugin/plugin.json` that shadows root — the
  build exits 1 naming the signal it found and pointing at `/universal-plugin:doctor`, and writes
  nothing.

  The rule in closed form: **the build errors if and only if the target set is empty *and* at least
  one pre-0.6 signal is present.** Both conditions matter independently, so all four combinations are
  distinct outcomes — empty ∧ signal errors; empty ∧ no signal is the definitive empty state above;
  a non-empty target set builds normally whether or not a signal is present. Gating on the empty
  target set is what keeps the error from reaching a project that still derives: the error can only
  fire where the build was already producing nothing.

  A manifest that merely omits the extensions block is deliberately **not** a pre-0.6 signal — it is
  as likely a manifest nobody has configured yet as one an upgrade left behind, and erroring on it
  would fail builds this rule has no quarrel with. `doctor` still reports it as `legacy-manifest`,
  which is what the empty state's `doctor` pointer is for.
- **Next-step suggestion** — a successful build's stderr ends with
  `→ universal-plugin plugin validate`.
- **Fail-loud, no prompts, help** — an unknown flag exits 1 naming the flag; the command never
  prompts interactively; `--help` exits 0 with a concise synopsis, flags, and one example.

**Non-goals** — checking a manifest without deriving output (`plugin validate`); scaffolding a new
project (`plugin init`); publishing or installing manifests (the `cyberplace` package); the shared
output-contract mechanics themselves ([`../../axi/`](../../axi/README.md) owns those); **resolving or
pinning the `npx <cli>@<version>` references a plugin's skills carry** — that is the release-time
[`plugin bundle`](../bundle/README.md) step, not a build step (the MCP-invocation pin above is a
different object — see the intro).

Every scenario in [`build.feature`](./build.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **target selection (`vendors ?? harnesses`)** | builds the `vendors` list, else all `harnesses` keys; correct per-vendor output paths; copilot-cli reported `canonical` when it declares no moving component kind |
| **merge then strip** | harness fields merged; canonical wrapper (`$schema`, `extensions`) + orchestration keys (`vendors`, `packagePath`, `harnesses`) stripped |
| **component path resolution** | `skills` resolved from a path string, a path array, and a `{ paths }` object; every declared directory searched; `./skills/` used only when nothing is declared; a declared-but-missing directory warned, an absent default not; a declaration in none of the three forms warned and read as nothing |
| **hook translation** | canonical PascalCase kept for claude-code and codex; camelCase, `version: 1`, and flattened matcher groups for cursor; derived file written beside the vendor manifest and pointed at; inline hooks translated; `--dry-run` derives nothing |
| **unrepresentable handlers (ADR-0011)** | per-drop warning naming vendor, event, and type; emptied event omitted; emptied file not written and the `hooks` field dropped; copilot-cli's drop removed from its derived namespace file |
| **MCP invocation pinning** | a marked entry's `args` specifier rewritten to `<pkg>@<version>` under either runner word (`npx`, `upx`), located as the first non-flag argument with or without a leading `-y`/`--yes`; an unmarked entry and an unrelated `npx` invocation left alone; an already-pinned specifier overwritten with a warning; guards (non-runner `command`, no manifest `version`, no specifier in `args`) warn and leave the entry |
| **marker stripping + delivery** | `pinToPluginVersion` absent from every derived manifest and derived MCP file; nothing marked derives nothing; an inline declaration stays inline, a path declaration gets `<vendor-dir>/mcp.json` and is repointed; the authored `mcp.json` untouched; copilot-cli warned rather than derived for (`mcp.json` does not move) |
| **the copilot spec-mode namespace (ADR-0015)** | declared agents, commands and rules copied under `com.github.copilot/` with agents renamed to `.agent.md`, resolved from all three `pathValue` forms, the schema default read when the field is absent, a declared-but-missing directory warned and an absent default not; hooks translated to `com.github.copilot/hooks/hooks.json`; a declared `lspServers` path copied to `com.github.copilot/lsp.json`, an inline map warned about; `skills/` and `mcp.json` not copied there; the vendor reported `built` at `com.github.copilot/`; an authored `extensions/` left alone by both the build and `--clean`; the canonical `plugin.json` never written |
| **`--vendor` filters** | filter to one vendor; a `--vendor` not among the targets fails |
| **eager validation** | missing manifest fails; codex requires description + version |
| **unknown vendors warn** | unknown vendor key in `harnesses` skipped with warning |
| **`--dry-run` / `--clean`** | dry-run writes nothing; clean removes stale output before rewrite |
| **catalog refresh (ADR-0010 §3)** | this plugin's entry re-derived in each existing repository catalog for the vendors built; other entries and top-level fields untouched; no catalog created; unchanged reported as unchanged; `--dry-run` plans only |
| **TOON default + aggregate (#1,#2,#4)** | stdout TOON, one row per vendor (`vendor, path, status`), pre-computed `built/skipped/failed` summary |
| **`--format json` / `--format toon`** | JSON escape hatch with `built` array + counts; `--format toon` names the default |
| **definitive empty state (#5)** | no targets → exit 0, TOON zero built rows + aggregate `built 0`, stderr "nothing to build", stderr names `/universal-plugin:doctor` |
| **a declaration this CLI no longer reads (#6)** | zero targets beside a top-level `vendorExtensions` block or a shadowing `.plugin/plugin.json` → exit 1 naming the signal and `/universal-plugin:doctor`, nothing written; the same signal beside deriving harnesses stays exit 0 |
| **next-step suggestion (#9)** | successful build's stderr ends with `→ universal-plugin plugin validate` |
| **fail-loud unknown flag (#6)** | unknown flag exits 1, stderr names it |
| **`--help` (#10)** | exits 0, concise synopsis + flags + one example |
