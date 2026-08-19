# 0011 — Warn and drop hook handlers a vendor cannot represent

**Status:** accepted
**Date:** 2026-08-18
**Extends:** [0007](./0007-adopt-agent-plugins-spec-canonical.md) — the canonical manifest is the one
authored artifact; this decides what the build does when one target cannot express what it declares.

## Context

The canonical schema already commits to one hooks form: PascalCase event names, Claude Code's
three-level shape (event → matcher group → handlers), and four handler types — `command`, `http`,
`prompt`, `agent`. The build never looked at it. `hooks` is a component path, and component paths pass
through to every derived manifest verbatim, so the same file reached four runtimes that do not read
the same file.

Casing is the smaller half of that. Re-verified in August 2026
(`.research/hook-event-survey/conclusion.md`):

| Vendor | Event casing | Handlers it runs | Hooks file shape |
|---|---|---|---|
| Claude Code | PascalCase | command, http, mcp_tool, prompt, agent | event → matcher group → handlers |
| Codex | PascalCase | command only — prompt and agent are parsed and skipped | same as Claude Code |
| Cursor | camelCase | command, prompt | `version: 1`; handlers flat under the event, each carrying its own `matcher` |
| Copilot CLI | either — the casing selects the payload format, and PascalCase selects the Claude-compatible one | command, http, prompt | `version: 1` |

Two things follow that the June research did not show. Copilot CLI needs no translation at all, so
only Cursor is renamed, and Cursor is also the only vendor whose file is a different *shape*. And
every vendor except Claude Code has a handler type it cannot run: a canonical manifest that uses
`http` or `agent` is asking three of the four targets for something they will not do.

That is the question this ADR exists to settle. A handler the target cannot represent has four
possible fates: emit it anyway, drop it silently, drop it with a warning, or fail the build.

**Emit it anyway** is the cheapest to implement and has the worst failure mode. Codex would tolerate
it — it documents unknown handler types as parsed and skipped. Cursor and Copilot CLI publish no such
guarantee, and a schema-validating reader that rejects the file rejects *all* of it. One `agent`
handler would then cost the plugin every hook it ships on that runtime. Trading a known local loss for
an unbounded remote one is the wrong trade.

**Fail the build** makes the canonical manifest hostage to the least capable target. An author who
lists four vendors could then only ever author `command` — the intersection — and the schema's other
three handler types would be unusable to anyone building for more than Claude Code. That inverts what
the canonical manifest is for. It is the superset by design; deriving *down* from it is the build's
job.

**Drop it silently** is the trade the build already refuses elsewhere. An undelivered
`harnesses.copilot-cli` field warns rather than vanishing, for the same reason: a plugin author cannot
fix a loss they cannot see.

## Decision

### 1. A handler the target cannot represent is dropped, and the build warns

One warning per dropped handler, naming the vendor, the event, and the handler type. The build stays
green: exit 0, status `built`. Dropping is a derivation outcome, not an error.

A matcher group left with no handlers is dropped; an event left with no groups is dropped; a hooks file
left with no events is not written at all, and the derived manifest carries no `hooks` field rather
than pointing at an empty one.

### 2. The build derives a hooks file only when the vendor's form differs

Claude Code reads the canonical file as authored. Codex does too, unless a handler was dropped for it.
When nothing changes, the derived manifest keeps the canonical `hooks` path and no second file exists
to drift. When something does change, the derived file sits beside that vendor's manifest —
`.cursor-plugin/hooks.json` beside `.cursor-plugin/plugin.json` — and the derived manifest's `hooks`
points at it.

### 3. Copilot CLI is warned about, never derived for

Copilot CLI reads the canonical root `plugin.json` directly (ADR-0007 as applied in
[`plugin/build/`](../../plugin/build/README.md)), so the build has no manifest of its own to repoint
and no derived file it could deliver. An `agent` handler is therefore reported as ignored at runtime
rather than dropped from a file. The warning is the whole remedy available.

### 4. Per-event handler restrictions are out of scope

Claude Code narrows some events further — `SessionStart` accepts `command` and `mcp_tool` only, not
every type the runtime supports. The build checks vendor-level support and not the per-event table.
That table is 32 events wide on one vendor alone and changes on the vendors' release cadence, and
getting it wrong drops a working hook. Vendor-level support is the claim the research actually
sustains.

## Consequences

- **The canonical manifest stays the superset.** Authoring `http` for Claude Code costs three warnings
  and reaches Claude Code. Nothing about a richer handler blocks a build.
- **A warning is the contract, so it has to be read.** `plugin build` already writes warnings to stderr
  and returns them under `warnings` in `--format json`; dropped handlers join that stream. An author
  who wants none is telling themselves to author `command`.
- **A dropped handler is invisible in the derived file by design.** The file is not annotated. JSON has
  no comment to carry the note, and the derived files are regenerated artifacts that no one should be
  reading for provenance.
- **`--strict` is deliberately not added now.** A flag that promoted these warnings to failures would
  be useful in CI and is a separate decision, with a separate question behind it — whether it covers
  every build warning or only this one. Nothing here forecloses it.
- **Vendor capability tables now live in the build.** They will decay, like every vendor fact in this
  repo. They carry the research pointer and a date, and the recheck triggers in
  `.research/hook-event-survey/` name what would move them.
