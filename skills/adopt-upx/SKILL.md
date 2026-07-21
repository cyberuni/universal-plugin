---
name: adopt-upx
description: Use this skill when the user wants to make their skills use upx — the fast local-first package runner shipped by universal-plugin. Trigger on phrases like "make my skills use upx", "adopt the upx runner", "speed up npx calls", "switch to upx", or "rewrite npx pins to upx". Rewrites `npx <pkg>@<version>` references to `upx <pkg>@^<major>` across one skill, a named set, or every skill in the project.
---

# Adopt upx

Rewrites `npx <pkg>@<version>` references inside `SKILL.md` files to `upx <pkg>@^<major>` — the
fast local-first runner shipped by `universal-plugin` (see
`packages/universal-plugin/.agents/spec/run/README.md` for the full `upx` contract).

## When to use

The user wants their project's skills to shell out via `upx` instead of `npx`, for the ~10× speed
win on repeated calls. This is an opt-in migration, not a default — see Tradeoff below before
running it broadly.

## Prerequisites

Install the runner:

```bash
npm i -g universal-plugin
```

This puts the `upx` bin on PATH. Verify:

```bash
upx --help
```

If `upx` isn't found after install, stop and fix PATH before rewriting anything — a rewritten
skill with no `upx` on PATH breaks for that user (see Tradeoff).

## Rewrite rule

`npx <pkg>@<version>` → `upx <pkg>@^<major>` — a caret range on the major version, not the exact
pin. That's the point: one global `upx` install then satisfies every skill's call to that CLI at
that major, instead of `npx` re-resolving+spawning per exact version every time.

Left alone (never rewritten):

- **Non-semver placeholders** — `npx universal-plugin@<version>` (angle-bracket doc placeholders
  aren't real pins)
- **Dist-tags** — `npx pkg@next`, `npx pkg@latest` (not a range `upx` can match against an
  installed version; these already go straight to `npx` inside `upx` itself on a miss)
- **Already-`upx` references** — nothing to do
- **Any skill marked `pin-exempt: true`** in its frontmatter — its version strings are
  documentation/illustration, not real invocations. This mirrors how `plugin bundle` treats
  pin-exempt skills (`packages/universal-plugin/.agents/spec/plugin/bundle/README.md`) — the
  `upgrade-universal-plugin` skill is a live example of a pin-exempt skill.

## Choose scope

Ask the user (or infer from their request) which of the three scopes applies:

| Scope | How to invoke |
|---|---|
| **A specific skill** | Pass its path: `skills/my-skill` (dir) or `skills/my-skill/SKILL.md` |
| **A named set** | Pass multiple paths and/or a glob: `skills/a skills/b "skills/foo-*"` |
| **All skills in the project** | Pass `--all` — walks the whole project for every `SKILL.md`, skipping `node_modules`, `.git`, `dist`, `build`, `.turbo` |

## Run the rewrite

The mechanism is `scripts/rewrite-upx.mjs` in this skill directory — run it directly, don't
hand-edit files:

```bash
# One skill
node "<this skill's dir>/scripts/rewrite-upx.mjs" skills/my-skill

# A named set (paths and/or globs)
node "<this skill's dir>/scripts/rewrite-upx.mjs" skills/my-skill skills/other-skill "skills/team-*"

# Every skill in the project
node "<this skill's dir>/scripts/rewrite-upx.mjs" --all
```

Preview without writing:

```bash
node "<this skill's dir>/scripts/rewrite-upx.mjs" --all --dry-run
```

The script reports, per file, how many references it rewrote and which skills it skipped as
pin-exempt, plus a final tally. It is **idempotent** — re-running over already-rewritten files is
a no-op (there's no `npx` left to match), so it's safe to run again after adding new skills.

## Tradeoff — say this out loud to the user

A skill rewritten to `upx` now depends on the `upx` bin being on that environment's PATH.
`npx` always ships with npm — every Node environment has it. `upx` does not — it only exists after
`npm i -g universal-plugin`. So this is a deliberate opt-in for environments where
`universal-plugin` is installed globally, not a safe-by-default swap.

Mitigating factor: `upx` itself falls back to plain `npx` on a miss (no local/global install
satisfies the range) — but that fallback only fires if the `upx` bin is present to run in the
first place. If `upx` isn't on PATH at all, the shell fails to find the command before `upx`'s own
fallback logic ever gets a chance to run.

## Verify

1. Re-run the script over the same scope — it should report `0 file(s) rewritten` (idempotent).
2. Spot-check a rewritten skill: the pin should read `upx <pkg>@^<major>`, not a concrete version.
3. Confirm any pin-exempt skills (e.g. `upgrade-universal-plugin`) were skipped, not rewritten.
4. If the project has a skill validator (`validate-skill` / `improve-skill`), run it over each
   touched skill to confirm the rewrite didn't break frontmatter or Markdown structure.

## Commit

Follow project commit discipline — one commit for this rewrite:

```text
chore(skills): adopt upx runner for <scope>
```
