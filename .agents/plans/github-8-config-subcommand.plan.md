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
  - content: "Spec gate R2: cold spec-judge re-dispatched to verify fixes; on ALIGNED true → freeze both .feature + ledger leash/gate + status handling"
    status: in_progress
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

Explore draft is COMPLETE and on disk (config/ group + add/get nodes, both `.feature` parse clean —
purely additive, nothing frozen touched; root spec.md capability/placement/by-concept updated).

**Blocked at the spec gate on the cold spec-judge** — dispatch failed on the session limit (resets
5am America/Los_Angeles). On resume:

1. Re-dispatch the cold `sdd:sdd-spec-judge` over the config nodes (brief: 4 locked decisions —
   AXI TOON default + `--format json` on get; `add` requires `name`; append/replace-by-name +
   preserve other keys; capability-first `config/` group + 2 unit nodes; all-new, nothing frozen).
2. Incorporate the verdict / any `<!-- open: -->` markers; loop if not converged (cap 3).
3. Spec gate: freeze `add.feature` + `get.feature` (`@frozen`), write `kind: leash` + `gate` lines
   to `ledger/github-8.<hash>.jsonl`, set root spec `status` handling (config nodes approved).
4. Deliver: impl `src/config/` (pure merge-by-name domain + fs adapter + cli/AXI wiring), one
   verification per frozen scenario, wire `configCommand()` into `src/cli.ts`; rebase onto main.
5. Impl gate + handoff: PR with `Closes #8`; record any follow-up (install-script adoption gated on
   version-locking) as a `kind: followup` ledger line.

No ledger `leash` line written yet (write it at gate entry on resume). Statusline skipped — no
`.agents/sdd/` reader wired.
