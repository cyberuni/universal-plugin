# 0009 — Split the plugin gateway skill into verb-shaped skills

**Status:** accepted
**Date:** 2026-08-18
**Supersedes:** the reach-by-route argument in [`plugin/version/`](../../plugin/version/README.md)
(*The skill question*) and the corresponding paragraph in [root `spec.md`](../../spec.md).

## Context

ADR-0005 §3 put an installable skill beside the verb it fronts. Root `spec.md` then answered a second
question — **reach**, how an agent finds a verb at all — with a single gateway skill whose route table
named one reference per operation. `plugin/version/` applied that rule directly: it wanted a reach
surface for `plugin version`, and took a route on the gateway rather than a skill beside it, recording
that "a competing top-level skill would fragment the table the gateway exists to be."

The gateway carried six operations: create, adopt, inspect, update, version, delete. It was then
rewritten as a five-phase workflow and renamed `init`, mirroring `buddy-agent-harness:init`.

The rename exposed what the route table had been hiding. No single name covers that set. `init` reads
as first-time setup, which is wrong for deleting a manifest or cutting a release. `plugin` is a noun
with no scope at all — it says what the skill is about, never what it does. A skill's name is the
first thing both an agent and a user scan, and one description that has to trigger on "convert this to
the open standard", "bump the version", and "delete the generated manifests" is a weaker match for
each of the three than a focused description would be.

The fragmentation the earlier decision feared is real, but it comes from **overlapping objects**, not
from skill count. Two skills competing to rewrite the same manifest fragment; a skill that only reads,
beside one that only writes, does not.

## Decision

Split the gateway into four skills, each named for what it does and scoped by the object it touches:

| Skill | Object | Operations |
|---|---|---|
| `init` | the canonical manifest's *declaration* | create, adopt, update |
| `doctor` | nothing — read-only | diagnose and report |
| `version` | the *released number* | bump, set, reconcile drift |
| `remove-plugin` | the *artifacts* | delete derived manifests, or the plugin |

`init` keeps the five-phase workflow (survey → classify → confirm → apply → verify) and its reference
tree. The `init`/`doctor` pairing mirrors `buddy-agent-harness`, where the same division already
holds: one skill repairs, the other only reports and hands repairs back.

`remove-plugin` takes the longer name deliberately. It joins `migrate-plugin`, `publish-plugin`, and
`upgrade-plugin`; a bare `remove` or `delete` would read as removing anything at all.

## Consequences

- **Exactly one skill writes the canonical manifest.** `init` does. `doctor` never writes, and says so
  in its own rules; `version` writes only the two authored version numbers and calls `build` for the
  rest; `remove-plugin` deletes artifacts and routes manifest edits back to `init`.
- **Each skill names the owner of the adjacent ask.** A Related-skills table is now load-bearing, not
  decoration — it is what keeps the four from competing.
- **A new verb still does not automatically earn a new skill.** It earns a route on the skill whose
  *object* it shares, and a skill of its own only when its object differs. `plugin version` earns one
  under this rule for the reason the old ADR-shaped argument missed: it moves the number a plugin
  releases under, not what the plugin declares.
- The reach rule in root `spec.md` is restated in these terms rather than dropped. Reach is still
  required of every verb; it is now satisfied by the skill that owns the verb's object.
- `plugin/version/`'s *The skill question* section is superseded, and points here.
