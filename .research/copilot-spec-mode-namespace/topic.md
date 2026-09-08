# Copilot CLI spec-mode component namespace (September 2026)

## Question

A plugin built by universal-plugin always declares the canonical Agent Plugins `$schema`. Where does
GitHub Copilot CLI then look for its native components — agents, commands, rules, hooks, LSP servers,
extensions — and does that differ from where it looks when the `$schema` is absent?

## Scope

**In scope:**
- Which component kinds Copilot CLI resolves from `com.github.copilot/` in spec mode
- Whether the namespace replaces or supplements the plugin root for those kinds
- Which kinds stay at the plugin root (skills, MCP)
- The runtime version the behavior changed in
- Whether an explicit manifest path overrides the namespace

**Out of scope:**
- VS Code and Copilot app resolution (asserted by GitHub's blog, not tested)
- Non-linux-x64 platforms
- Marketplace and installation flows
- What `extensions/` (canvases) contain

## Source angles

- The shipped runtime itself: `@github/copilot-linux-x64` 1.0.83, and the `changelog.json` inside it
- Controlled A/B runs against that binary with an isolated `HOME`
- GitHub's Agent Plugins 1.0 GA changelog post
- The published CLI plugin reference on docs.github.com

## Findings

### The namespace is a mode switch, not a search path

Copilot CLI has two layouts, and the canonical `$schema` selects between them. Without it the runtime
reads its documented native layout from the plugin root. With it — spec mode — the same kinds resolve
from `com.github.copilot/` and the root copies are not read at all. Adding an explicit `"agents":
"agents/"` to a spec-mode manifest does not bring the root path back (E06), which is what
distinguishes a mode switch from a default that a manifest can override.

### What moves and what stays

The runtime's own changelog for 1.0.80-0 gives the list without ambiguity (E02): `commands/`,
`agents/`, `rules/`, `hooks/hooks.json`, `lsp.json`, `extensions/`. `skills/` and `mcp.json` are
absent from it, and the skills half is separately confirmed by experiment (E01) — a probe shipping a
skill in both places installed exactly one.

`extensions/` is the odd member. It was introduced in 1.0.79 under the namespace and never had a root
path (E03), so for it the namespace is the only location rather than a relocation.

### Timeline

| Version | Change |
| --- | --- |
| 1.0.6 | Open Plugin Spec file locations recognized for manifest and marketplace discovery |
| 1.0.74 | Open Plugin Spec v1 manifests and `mcp.json` supported |
| 1.0.79 | `com.github.copilot/extensions/` added |
| 1.0.80-0 | **Breaking** — spec-mode native components read only under `com.github.copilot/` |
| 1.0.80-0 | Root-left components now reported instead of silently lost |

### The published docs disagree with the shipped runtime

The CLI plugin reference (E05) still describes only the native root layout and says spec support is
"additive on top of standard plugin loading". Additive would mean the root paths keep working. They
do not. The section that would document spec mode is an empty bullet list. Two independent
first-party sources — the binary's own changelog and a controlled A/B against the binary — say
otherwise, so the docs were treated as stale rather than authoritative.

GitHub's GA post (E04) is closer but reads as supplement-not-replace: "one package stays portable and
keeps its Copilot behavior". That is true of the *package*, not of a single directory tree — the
package stays portable because other clients ignore the namespace, not because the root keeps
working for Copilot.

### The consequence for a build tool

Because the namespace replaces the root, a tool that emits one tree cannot serve a native-mode and a
spec-mode Copilot CLI consumer at once for the kinds that move. Emitting both a root `agents/` and a
`com.github.copilot/agents/` is not a compatibility shim — it is two copies where a spec-mode runtime
reads one and a native-mode runtime reads the other, and they drift. Choosing spec mode is choosing
the namespace.

## Method notes

The 1.0.83 tarball unpacks to a 160 MB launcher plus a 7.6 MB `app.js`; the plugin loader is not in
`app.js` and the launcher's strings are not greppable, so the loader was not read directly. The
`changelog.json` that ships alongside them is, and it is first-party. Attempts to reproduce the
component-by-component A/B locally stopped at authentication: `copilot plugins list` enumerates
plugins, skills, MCP servers, instructions and LSP servers but not agents, commands or hooks, and a
non-interactive session logs "No model backend … skipping custom agents load" before plugin
activation. The agents result in E01 comes from an earlier run that had a session.
