---
'universal-plugin': minor
---

Replace the `plugin` gateway skill with four verb-shaped skills: `init`, `doctor`, `version`, and `remove-plugin`.

The gateway routed six operations behind one name, and no single name covers that set. `init` reads as first-time setup, which is wrong for deleting a manifest; `plugin` is a noun that says what the skill is about and never what it does. One description that has to trigger on "convert this to the open standard", "bump the version", and "delete the generated manifests" is a weaker match for each than three focused ones.

Each skill is now scoped by the object it touches, which is also what keeps them from competing for the same asks:

- **`init`** — the manifest's declaration: create, adopt, update. Runs five phases (survey, classify, confirm, apply, verify), where confirm is the gate the old gateway lacked: adoption turns files the user maintains into build output, and that needed approval it never asked for.
- **`doctor`** — read-only diagnosis. Reports what is declared, unbuilt, stale, hand-edited, drifting, or shadowing, and hands every repair to the skill that owns it.
- **`version`** — the released number, in both release models: changesets-decided and carried in by `publish sync-version`, or moved directly by `plugin version`.
- **`remove-plugin`** — the artifacts: derived manifests, a stale `.github/plugin/plugin.json`, a shadowing `.plugin/plugin.json`, or the whole plugin behind a confirmation.

Also in this change:

- `scripts/init.mjs` and `scripts/version.mjs` run their CLI verb from the copy shipped beside the skill, so neither a scaffold nor a release number needs a network fetch.
- `doctor` ships `scripts/doctor.mjs`: it composes `plugin build --dry-run --format json` with the filesystem facts build cannot see — missing and stale derived manifests, a shadowing `.plugin/plugin.json`, version drift between the two authored numbers — and emits one JSON object. It stays a thin composition so it folds into `plugin validate` when that command lands, rather than competing with it.
- Each skill carries a README.
- One reference per vendor, read only when that vendor is enabled, replacing the vendor columns the create reference carried inline.
- A frontmatter reference documenting `invocation-policy`, including the part that surprises people: the build rewrites the authored `SKILL.md` to carry the derived flags.
- The create reference no longer claims `plugin build` is unavailable — it has shipped, and the reference now names its flags and the warnings worth reading.
- The vendor references state plainly that the build does not translate hook event names across the PascalCase/camelCase divide, which it does not (tracked in #41).

ADR-0009 records the split and supersedes the single-gateway reach rule in `spec.md` and `plugin/version/`.
