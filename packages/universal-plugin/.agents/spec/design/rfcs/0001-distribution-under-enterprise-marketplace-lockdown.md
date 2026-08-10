# RFC-0001 — Distribution under enterprise marketplace lockdown

**Status:** open (proposal — no decision yet)
**Date:** 2026-08-09
**Relates to:** ADR-0006 (`plugin init --npm`, the publish half) · ADR-0007 (canonical + per-harness
derivation) · `run/` (the `upx` bin) · `plugin/bundle/` (pins `npx`/`upx` references)

> RFCs capture a **forward-looking problem and its option space** before it is decided. When one is
> resolved it becomes an ADR in [`../decisions/`](../decisions/). This RFC is not a commitment.

## Summary

`plugin init --npm` wires a package to ship its plugin through Claude Code's **npm plugin source**.
That source works today for a user adding their **own** marketplace, but it is **not** supported for
**organization-distributed (Team / Enterprise) marketplaces**. As enterprises increasingly **lock down
which marketplaces a user may add**, the personal-add escape hatch closes — and npm-distributed plugins
become uninstallable for enterprise users. This RFC records the risk and the options so a direction can
be chosen before it bites.

## Background — what is and isn't restricted today

- **Personal add: fine.** A user who runs `/plugin marketplace add` on a marketplace of their own can
  install `npm`-source plugins normally.
- **Org distribution: npm excluded.** Distributing a marketplace through *Organization settings >
  Plugins* on a Team/Enterprise plan supports only `github`, `url`, and `git-subdir` sources —
  *"`npm` and `archive` sources are not"* (org sync reads the marketplace repo through the Claude
  GitHub / GHE App). The documented workaround is to **vendor** each plugin's folder into the
  marketplace repository and reference it by **relative path**, so org sync packages it at distribution.
- **The lockdown is already real.** Claude Code supports marketplaces that *"an administrator
  allowlists in managed settings."* So the mechanism for an enterprise to restrict users to only
  org-approved marketplaces exists now.

## The problem

Compose those three facts forward: once an enterprise **allowlists** marketplaces (so users cannot add
their own) **and** org-distributed marketplaces **exclude npm sources**, an `npm`-distributed plugin has
**no install path** for enterprise users — the segment that most needs governed distribution. Today the
gap is masked because users can still add a personal marketplace; lockdown removes that mask.

## Options

1. **Wait on Claude Code to support npm for org distribution.** Out of our control; **track upstream**.
   The current org path deliberately avoids npm (auth model), so this may not come.
2. **Emit an org-distributable layout from `build`.** Produce a plugin form consumable by `github` /
   `git-subdir` / relative-path — i.e. the built plugin as a directory an org marketplace repo can
   vendor. Keeps the plugin a *marketplace plugin*, just not via npm. New build output shape.
3. **Fall back to runtime invocation via `npx` / `upx`.** Rather than distribute the capability as an
   installed marketplace plugin, have the plugin's skills invoke the CLI at runtime through
   `npx <cli>@<version>` / `upx`. This **sidesteps the source-type restriction entirely** — nothing is
   installed as a plugin *source*; the tool runs from npm at call time. **Notable because we already own
   the machinery:** `run/` ships the `upx` runner and `plugin bundle` already pins `npx`/`upx`
   references in a plugin's skills. This is the lowest-new-surface enterprise-safe path.
4. **Relative-path vendoring.** Adopt the docs' own workaround as a first-class `build`/`init` target:
   lay the built plugin out so an org marketplace repo can carry it by relative path.

## Recommendation (for discussion — not decided)

Keep `plugin init --npm` for personal/public distribution (it is correct there). For the enterprise
path, the leading candidates are **option 3 (`npx`/`upx` runtime invocation)** because it reuses `run/`
+ `bundle` and needs the least new surface, and **option 2/4 (git-subdir / relative-path layout)** as
the "stays a real marketplace plugin" alternative. Track option 1 upstream regardless. Decide when
enterprise lockdown moves from foreseeable to observed, or when a concrete enterprise consumer appears.

## References

- [Claude Code — Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
  — org-distribution source rules ("`npm` and `archive` sources are not" supported) and the
  relative-path vendoring workaround (verified 2026-08-09).
- [Claude Code — Recommend plugins for your org](https://code.claude.com/docs/en/plugin-relevance)
  — marketplaces "an administrator allowlists in managed settings" (the lockdown mechanism).
