# 0015 — Derive `com.github.copilot/` for Copilot CLI; it is a derived-output vendor

**Status:** accepted
**Date:** 2026-09-07
**Builds on:** [0007](./0007-adopt-agent-plugins-spec-canonical.md) — the canonical `$schema` it adopted
is what puts every plugin this tool builds into the mode this ADR handles.
**Revises:** [0011](./0011-warn-and-drop-unrepresentable-hook-handlers.md) §3 — "Copilot CLI is warned
about, never derived for" no longer holds for hooks; and
[0004](./0004-slash-invocation.md)'s premise that Copilot CLI has no command surface to derive to.

## Context

ADR-0007 made root `plugin.json` the canonical manifest, carrying the Agent Plugins Specification
v1.0.0 `$schema`. Copilot CLI reads that file directly, so the build derived **nothing** for it and
reported the vendor with status `canonical` — success, not a skipped target.

That was true of the manifest and false of everything else. Declaring the canonical `$schema` puts a
plugin into what Copilot CLI calls spec mode, and spec mode moves the runtime's **native** components
out of the plugin root into a reverse-domain namespace directory:

| Component | Spec-mode path | Root path still read |
| --- | --- | --- |
| Custom agents | `com.github.copilot/agents/` | no |
| Commands | `com.github.copilot/commands/` | no |
| Rules | `com.github.copilot/rules/` | no |
| Hooks | `com.github.copilot/hooks/hooks.json` | no |
| LSP servers | `com.github.copilot/lsp.json` | no |
| Extensions (canvases) | `com.github.copilot/extensions/` | never had one |
| Skills | `skills/` | **yes — skills do not move** |
| MCP servers | `mcp.json` | **yes** |

The namespace **replaces** the root for the kinds that move rather than supplementing it, and an
explicit component path in the manifest does not opt back into root loading.[^ab] The change landed
in Copilot CLI 1.0.80-0 and the runtime's own changelog labels it breaking.[^changelog]

So `plugin init` writes a `$schema` that silently costs the plugin every agent, command, rule, hook
and LSP server it ships, on the one vendor the build reported as fully served. Skills kept working,
which is what made it survivable long enough to reach a release.

Two sources disagree with the above and were not followed. GitHub's GA post frames the namespace as
keeping one package portable, which reads as supplement-not-replace;[^ga] the CLI plugin reference
says spec support is "additive on top of standard plugin loading" and documents only the native root
layout, with an empty bullet list where spec mode would be explained.[^ref] Both are contradicted by a
controlled A/B against the shipped binary and by the binary's own changelog. Where published docs and
the shipped runtime disagree, this project follows the runtime. Full record:
[`.research/copilot-spec-mode-namespace/`](../../../../../../.research/copilot-spec-mode-namespace/conclusion.md).

## Decision

### 1. Copilot CLI is a derived-output vendor

`plugin build` derives a `com.github.copilot/` tree for `copilot-cli` from the canonical manifest,
covering exactly the kinds the runtime moved:

```
com.github.copilot/agents/      ← the canonical agents path
com.github.copilot/commands/    ← the canonical commands path
com.github.copilot/rules/       ← the canonical rules path
com.github.copilot/hooks/hooks.json
com.github.copilot/lsp.json
com.github.copilot/extensions/  ← authored, passed through
```

The vendor reports `built` with path `com.github.copilot/` when it derives at least one of these. A
plugin declaring none of the moving kinds has nothing to derive and keeps reporting `canonical` with
path `plugin.json` — the pre-existing result stays correct for the plugins it was correct for.

### 2. The manifest stays canonical

Copilot CLI still reads root `plugin.json`, and the canonical field set is still closed. The three
consequences that followed from that are unchanged:

- a `harnesses.copilot-cli` override still has no delivery path and still warns;
- a plugin dependency declaration still sits under `extensions`, which Copilot CLI ignores
  ([ADR-0013](./0013-plugin-dependencies.md));
- a `pinToPluginVersion` MCP entry is still not delivered — `mcp.json` did not move, and the
  canonical `mcp.json` is authored, never rewritten by the build.

"Derived-output vendor" describes the components, not the manifest. Copilot CLI is the only vendor
where those two answers differ, and the build's row reports the component tree because that is the
part the build now owns.

### 3. Component kinds are derived by copy, into a tree the build owns

The authored files stay where the canonical layout puts them (`agents/`, `commands/`, `rules/`,
`hooks/hooks.json`, and whatever `lspServers` names). The build copies them under the namespace. That
is the same relationship every other vendor's output has to the canonical — regenerable, replaced on
`--clean`, planned-not-written under `--dry-run`, and shipped by being listed in `package.json`
`files`. Nothing under `com.github.copilot/` is authored except `extensions/`.

Agents are renamed on the way. Copilot CLI reads `agents/` as `.agent.md` files,[^agentmd] while the
canonical `agents/` is the Claude Code-shaped `*.md`. A copy that kept the authored name would land a
file the runtime ignores — the silent loss this ADR exists to end, moved one directory over. So an
agent copied under the namespace gets the `.agent.md` suffix, and one already carrying it is copied
unchanged. Commands and rules are copied verbatim: the runtime documents no extension for either, and
inventing one would be a guess.

Hooks are the exception to "copy": they are **translated**, exactly as for every other vendor.
Copilot CLI now has a derived hooks file, so a handler it cannot run is dropped from that file with a
warning rather than left in place and reported as ignored at runtime. This is the ADR-0011 revision.

`extensions/` is inverted. It never had a root location, so there is nothing to derive it from — an
author writes `com.github.copilot/extensions/` directly and the build leaves it alone. It is the one
path under the namespace the build neither writes nor cleans.

Resolution follows the same `pathValue` contract `skills` follows, defaults included: `agents`,
`commands` and `rules` each carry the schema's default location, read when the field is absent. The
default is what an undeclared field *means*, never a stand-in for a declared path that did not
resolve — so a declared directory that is missing warns and an unused default does not.

`lsp.json` is carried, not composed. A declared `lspServers` **path** is copied verbatim, which needs
no knowledge of the file's top-level shape. An **inline** `lspServers` map would need one, and the
runtime documents none — so it warns and delivers nothing, the same warn-rather-than-guess remedy the
undelivered harness override gets. The evidence supports the file's *location*, not its schema, and
the build claims only what the evidence supports.

### 4. One tree cannot serve both Copilot layouts

Because the namespace replaces the root, a plugin cannot be read by a native-mode and a spec-mode
Copilot CLI from the same directory for the kinds that move. This project does not try. Every plugin
it builds declares the canonical `$schema` (ADR-0007), so every plugin it builds is spec mode, and
the namespace is the only Copilot layout it targets. A plugin that wants native-mode Copilot
compatibility wants a different canonical manifest, which is a different decision than this one.

The cost is duplication: the same agent file exists at `agents/x.agent.md` and at
`com.github.copilot/agents/x.agent.md`. That is the cost of derivation and it is already paid four
times over for the manifests; the alternative — authoring under the namespace and pointing the other
vendors' derived manifests at it — is rejected below.

### 5. `doctor` reports native components left at the root

A repository whose canonical manifest declares any of the moving kinds, targets `copilot-cli`, and
has no matching `com.github.copilot/` tree, is a plugin that loads none of them on Copilot CLI.
`doctor` reports it and routes to `plugin build`. This is the check that would have caught the defect
before a release, and it is the reason the finding is separate from the generic staleness check: the
tree can be entirely absent on a repository whose four vendor manifests are all current.

## Consequences

- **Copilot CLI stops being the zero-output vendor.** `VENDOR_OUTPUT['copilot-cli']` no longer names
  the canonical manifest as an output path. The generic manifest-write path must never run for this
  vendor — pointing it at root `plugin.json` would have the build overwrite its own source of truth.
- **A new output directory ships.** `com.github.copilot/` joins `.claude-plugin/`, `.cursor-plugin/`
  and `.codex-plugin/` in `package.json` `files`, and in what `plugin init --npm` wires up.
- **ADR-0011 §3 is narrowed to what it still covers.** Copilot CLI's hooks are derived and translated
  like any other vendor's. What survives of §3 is the manifest-level half: fields that can only ride
  in the manifest still have no delivery path.
- **The `canonical` status stays in the vocabulary** for the plugin that declares no moving kinds, so
  the AXI summary line's `served by plugin.json N` is still reachable and still means what it said.
- **ADR-0004's Copilot CLI premise expires.** Copilot CLI now has a commands surface. Its decision
  stands — `commands` is an extension field, not a canonical root one — but the reason its
  Alternatives bullet led with is gone, and the note there says so.
- **`lspServers` gains a derivation, for the path form only.** It was carried through into vendor
  manifests verbatim and derived nowhere; Copilot is the first vendor to get a file for it, and only
  when the declaration names a file to copy.
- **Two frozen scenarios in `plugin/build/build.feature` are rewritten**, not extended: the ones
  asserting that copilot-cli derives nothing and that an unsupported handler is only reported. Both
  assert behavior the runtime has since made false. The CR authorizes the narrowing.
- **The evidence decays.** Four of the five kinds rest on the runtime's changelog rather than on a
  reproduced experiment, and the published reference still contradicts all of it. Re-verify against
  `changelog.json` in the shipped `@github/copilot-*` package, not against docs.github.com, before
  relying on the kind list again.

## Alternatives considered

- **Author under `com.github.copilot/` and point the other vendors' manifests at it.** Rejected — it
  makes one vendor's namespace the canonical home for components the spec places at the plugin root,
  inverting ADR-0007. The duplication it avoids is the duplication derivation is made of.
- **Symlink `com.github.copilot/agents/` to `agents/`.** Rejected on the same ground ADR-0007
  rejected symlinked manifests, plus two of its own: npm packing and Windows checkouts both treat
  directory symlinks poorly, and the tree would stop being something `--clean` can reason about.
- **Emit both layouts and let the runtime pick.** Rejected — there is nothing to pick. A spec-mode
  runtime reads the namespace and a native-mode runtime reads the root; emitting both produces two
  copies that drift, not compatibility.
- **Drop the `$schema` from the canonical manifest so Copilot stays in native mode.** Rejected —
  it un-adopts ADR-0007 to work around one vendor, and costs every other spec-mode consumer.
- **Declare the root paths explicitly in the manifest and change nothing else.** Rejected — proven
  not to work. A spec-mode manifest carrying `"agents": "agents/"` still loads nothing.[^ab]
- **Warn and derive nothing, as with the undeliverable harness override.** Rejected — a warning is
  the right remedy when no delivery path exists. Here one does; declining to use it would leave the
  tool knowingly shipping agent-less plugins.

[^ab]: Controlled A/B against `@github/copilot-linux-x64` 1.0.83 on linux-x64, isolated `HOME`, one
    variable changed at a time. Canonical `$schema` + `agents/x.agent.md` loads nothing, with or
    without an explicit `"agents": "agents/"`; the same file under `com.github.copilot/agents/` loads.
    A probe shipping a skill in both places installed one. Recorded as E01/E06 in
    [`.research/copilot-spec-mode-namespace/evidence.md`](../../../../../../.research/copilot-spec-mode-namespace/evidence.md).

[^changelog]: `changelog.json` shipped inside `@github/copilot-linux-x64` 1.0.83, entry for 1.0.80-0:
    "Breaking: Agent Plugins spec plugins now read commands/, agents/, rules/, hooks/hooks.json,
    lsp.json, and extensions/ only under com.github.copilot/ — no longer from the plugin root."
    Extensions arrived one release earlier, in 1.0.79. Recorded as E02/E03.

[^ga]: <https://github.blog/changelog/2026-08-12-agent-plugins-1-0-in-vs-code-copilot-cli-and-the-copilot-app/>

[^ref]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>

[^agentmd]: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli>
    — "Each custom agent is defined by a Markdown file with an `.agent.md` extension", and a custom
    agent is selected by "the file name of the custom agent profile, without the `.agent.md`
    extension". Cited rather than the plugin reference: this ADR's Context calls that page stale for
    spec mode, so it is no source for a rule the build now depends on. The `.agent.md` convention is
    native-mode behavior the namespace inherits, and this page documents it directly.
