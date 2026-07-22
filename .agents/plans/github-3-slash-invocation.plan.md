---
cr-ref: github-3
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/3
status: draft
todos:
  - content: "Intake: fetch #3, locate spec (implemented), find #3 mostly stale; user scoped CR to slash-invocation decision only"
    status: completed
  - content: "Explore: research commands/ vs skills/ slash-invocation across Claude Code, Cursor, Codex, Copilot CLI (leverage .research/ + targeted lookups)"
    status: pending
  - content: "Explore: decide — pure design ADR (0004-slash-invocation) OR does it mandate a plugin/build derivation behavior change (→ revise plugin/build node)?"
    status: pending
  - content: "Author: write ADR 0004-slash-invocation.md under design/decisions/ (if behavior change, add spec+.feature+gate for plugin/build)"
    status: pending
  - content: "Handoff: commit ADR; comment on #3 mapping every item to status (done/rejected/open); close #3 as superseded"
    status: pending
---

# github-3 — slash-invocation decision (commands/ vs skills/ across vendors)

CR against `packages/universal-plugin`. Source: issue #3 (scoped down).

## Context

Issue #3 is a stale research-phase design proposal for the whole CLI. On intake the CLI was found
already built + spec'd + `implemented` (plugin build/validate/init/bundle, governance, config, run,
AXI, screaming+clean arch, tooling). Most of #3's remaining items are **deliberately out of charter**
(marketplace / plugin-install verbs / hook / prepare → depart to `cyberplace`/`cyberspace`/`aced`,
per ADR-0001 realignment + the root spec Placement non-goals).

The user scoped this mission to the **one genuinely-open item**: #3's "Open Research Item" —
clarify the `commands/` vs `skills/` distinction for slash invocation across vendors, capture as an
ADR (or shipped `slash-invocation.md` governance).

## The question

How does each Tier-1 runtime (Claude Code, Cursor, Codex, Copilot CLI) expose user-typed slash
commands vs. model-invoked skills? Does `plugin build` derive them differently per vendor today, and
should the canonical `.plugin/plugin.json` carry a `commands/` concept distinct from `skills/`?

## Route decision (explore must settle)

- **Pure design ADR** — if the conclusion is a naming/authoring convention with no change to
  `plugin build` derivation output → `.agents/spec/design/decisions/0004-slash-invocation.md`, no
  `.feature`, escapes the gate (design record, like ADR-0001..0003).
- **Behavioral revise** — if the conclusion mandates `plugin build` derive commands vs skills
  differently per vendor → a `revise` CR on `plugin/build/` (spec + frozen `.feature` + spec/impl
  gates), with the ADR as the design note.

## NEXT

Run the slash-invocation research (todo 2): survey how Claude Code / Cursor / Codex / Copilot CLI
distinguish user-typed slash commands from model-invoked skills, and whether `plugin build` currently
emits any `commands/` artifacts. Then settle the route decision above with the user.
