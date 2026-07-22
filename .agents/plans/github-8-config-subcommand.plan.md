---
cr-ref: github-8
project: universal-plugin
project-path: packages/universal-plugin
source: https://github.com/cyberuni/universal-plugin/issues/8
status: draft
todos:
  - content: "Intake: fetch #8, locate spec, scaffold plan"
    status: completed
  - content: "Explore: grill decision points — 4 locked (AXI TOON+json, require name, ship now, config/ group + 2 nodes)"
    status: completed
  - content: "Explore: scaffolded config/ group + config/add + config/get; README + .feature drafted; root spec.md maps + by-concept updated"
    status: completed
  - content: "Explore: build-to-learn confirmed vs harness (output()/printTable AXI shape, JSON read/write preserves keys, clean-arch fits)"
    status: completed
  - content: "Spec gate R1: cold spec-judge ALIGNED false — fixed exit codes, table rows, position scenario, axi list; reserved-key=packagePath only (vendors dropped as dead); charter=keep+note"
    status: completed
  - content: "Spec gate: R3 cold spec-judge ALIGNED true (0 findings); ratified in-session; both .feature frozen, ledger leash+gate + correction; status approved. Committed."
    status: completed
  - content: "Deliver: src/config/ (domain+fs+cli, clean-arch), wired into cli.ts; 42 config tests; verify 295/295; knip clean; rebased onto main c26b019 (spec.md approval conflict resolved to github-8)"
    status: completed
  - content: "Impl gate: cold sdd-impl-judge approve (33/33, mutation-backstopped); ratified; status implemented + approval.impl; impl gate ledger line. Post-gate: (none) empty-state + removed stale cli-command.md"
    status: completed
  - content: "Handoff: Warden placement check 0-blocking (config/ at blessed home); PR #16 (Closes #8); followup #18 filed (install-script adoption gated on version-locking)"
    status: completed
  - content: "Deliver: impl config command group + verification per frozen scenario; rebase onto main"
    status: pending
  - content: "Impl gate + handoff (PR, Closes #8)"
    status: pending
---

# github-8 — config add / config get subcommands

CR against `packages/universal-plugin`. Source: issue #8. Design ref: `specs/plugin-config.md`.

## Problem

Plugins need a standard way to register keyed metadata into `.agents/universal-plugin.json` at
install time, so other plugins discover them lazily at runtime (no session overhead). Motivating
case: SDD reads an `sdd-plugins` key to find which plugins handle spec work for which domains.

## Command surface (from issue + specs/plugin-config.md)

- `universal-plugin config add --key <key> --entry '<json>'` — append to the array at `key`, or
  replace the element whose `name` matches (idempotent for re-installs).
- `universal-plugin config get --key <key>` — print the array at `key` to stdout.
- Both resolve `.agents/universal-plugin.json` from cwd. Free-form entry JSON (no schema
  enforcement — key schema is the consumer's). Preserve existing keys (`packagePath`, `vendors`).

## Placement (provisional — capability-first)

New `config/` command group (peer of `plugin/`, `governance/`, `run/`) holding two behavioral unit
nodes `config/add/` + `config/get/`. Mirrors the `plugin/` group → `plugin/build`, `plugin/bundle`
shape. Finalized at handoff by Warden.

## Open decisions (grill)

1. AXI output vs raw JSON — issue says "prints array as JSON"; project spec mandates AXI TOON
   default for every command. Resolve the conflict (likely: `config get` is a machine-consumed
   value → raw JSON stdout is the AXI-correct escape, but confirm).
2. `config get` on a missing/empty key — `[]` + exit 0 (definitive empty state)?
3. `config add` entry with no `name` field — append always, or error?
4. Blocker scope — #8 says version-locking must ship first; upx/#10 landed. Does the command ship
   now (adoption in install scripts is downstream), or wait?
5. `.agents/universal-plugin.json` absent — does `config add` create it?

## NEXT

**Mission complete — landed, awaiting merge.** PR #16 (`Closes #8`) is open against `main` with all
gates passed. Nothing left to do until merge.

On merge: #8 auto-closes; retire this plan + combat log via the doctrine loop
(`sdd:plan-retirement`). Follow-up #18 (install-script adoption, gated on version-locking) re-enters
SDD only when a later mission is started from it.

Corpus formation pass is due (on-demand, not auto-run) — `sdd:manage` → "audit the corpus structure".
