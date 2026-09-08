---
status: active
cr: github-60
source: https://github.com/cyberuni/universal-plugin/issues/60
spec: packages/universal-plugin/.agents/spec
todos:
  - content: "Split schema/v1.json: delete the vendored Agent Plugins envelope, keep the org.cyberuni.universal-plugin namespace body"
    status: completed
  - content: "Repoint skills/init/SKILL.md + README.md off the raw.githubusercontent schema URL"
    status: completed
  - content: "Behavioral: readSkills resolves every pathValue form (string, array, {paths}) — spec + frozen scenarios + impl"
    status: completed
  - content: "Changeset, verification, PR against main closing #60"
    status: completed
---

# github-60 — stop vendoring the Agent Plugins schema

`schema/v1.json` is a fork of the upstream **Agent Plugins Specification v1.0.0** manifest schema.
Split it on the ownership line: the envelope is upstream's, the `extensions` namespace body is ours.

## Scope

Two halves, deliberately different in kind.

**Non-behavioral (escapes the suite).** `schema/` is a published contract artifact, loaded by no
code. Deleting the vendored envelope and retaining a namespace-scoped schema changes no observable
CLI behavior, and neither does repointing the two `skills/init` documents. Carried in this CR,
recorded here, no spec node and no scenarios.

**Behavioral (one unit — `plugin/build/`).** `readSkills` resolves only the string form of a
`pathValue`; the array and `{ paths }` forms fall through to `./skills/` silently. That is a
contract the extension schema states and the build does not honor. Additive scenarios on the
frozen `plugin/build/build.feature` (nothing narrowed — self-clears the freeze).

Sweep for the same rule elsewhere: `readCanonicalHooks` is the only other multi-form resolver and
is correct — `hooksValue` admits string / `{ paths }` / inline, not a bare array, and it handles
all three.

## Decisions

- The retained schema's root **is** the namespace object, not a manifest that re-states the spec
  around it.
- It ships **inside the npm package** (`packages/universal-plugin/schema/`, added to `files`), which
  is what the issue's motivation asks for: a consumer resolving these fields against an installed
  dependency reads the schema from that dependency.
- **A declared skills directory that does not exist warns.** Beyond the issue's literal defect, but
  the same defect class: silence. It also makes `skills` consistent with the rule `readCanonicalHooks`
  already applies to `hooks` (`hooks file "<path>" not found — left untranslated`). The *undeclared*
  default being absent stays silent — most plugins ship no skills.
- **No `$id`.** The old one advertised a `raw.githubusercontent.com` branch URL; the repo publishes
  no schema host, so asserting a URL nothing serves would repeat the defect in a new place. The
  schema versions with the package that defines the fields.

## NEXT

Landed. Both gates self-asserted within leash (`auto-all`) on cold-judge passes: spec gate round 4
(3 lenses PASS, ALIGNED true) after rounds 1–3 blocked at the governance pre-flight; impl gate 8/8
with the mutation experiment re-run independently by the judge. Root `spec.md` stays
`status: implemented` — the suite edit was additive, so the freeze self-cleared and no re-open was
needed.

Three follow-ups are recorded in the ledger shard and not done here: the `plugin/build/` and
`plugin/bundle/` nodes still lack `## What` / `## Control Flow` / `## Scenario map`; the retained
extension schema is still loaded by no code (`plugin validate` remains impl-deferred); and
`resolvePathValue` returns empty in silence for the schema-invalid `skills: []` and `{ paths: [] }`
shapes.
