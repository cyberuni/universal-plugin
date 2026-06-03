# ADR-0001: Name the plugin lifecycle skill `prepare`

**Date:** 2026-06-02
**Status:** Accepted

## Context

Vendor-controlled plugin installation does not guarantee that extra artifacts (e.g. `governances/`, `assets/`) are deployed correctly — vendors only handle what their own manifest spec defines. A plugin-level skill is needed to materialize these artifacts at install and update time.

The skill needs a name. Candidates considered:

| Name | Rationale | Problem |
|---|---|---|
| `init` | Borrowed from Claude Code's `init` skill; familiar in this ecosystem | Implies first-time setup only; misleading when the skill must also run on updates |
| `setup` | Generic, broadly understood | Same first-time connotation as `init`; no prior art that implies re-runnability |
| `postinstall` | Mirrors npm `postinstall` lifecycle hook; trigger is explicit | Tied to install framing; does not obviously cover updates |
| `prepare` | npm `prepare` script runs on both `npm install` and `npm publish`; Maven `prepare` phase is also re-entrant | None — matches the required semantics |

## Decision

Name the skill **`prepare`**.

The skill runs on both plugin install and plugin update. It is designed to be idempotent — safe to re-run on every lifecycle event. `prepare` is the closest prior art with those exact semantics (npm, Maven), making the intent clear without requiring documentation to override the name's implication.

## Consequences

- Plugin authors implementing setup logic use a `prepare` skill, not `init` or `setup`.
- The skill must be idempotent by design; running it twice on unchanged state must produce no side effects.
- `cyber-skills` tooling that surfaces plugin lifecycle hooks should expose this as `prepare`.
- Any existing `init-*` naming in the plugin ecosystem should be evaluated for migration to `prepare` where the re-runnability property applies.
