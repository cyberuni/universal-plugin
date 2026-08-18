---
'universal-plugin': minor
---

Replace the `plugin` gateway skill with `init`, a phased version of the same route table.

The gateway routed six operations well but said nothing about the order in which an agent should reach them. It read the project in a "Step 0" that fed a table, then handed off to one reference, so nothing forced a plan past the user before a manifest was rewritten — adoption in particular turns files the user maintains into build output.

`init` keeps every route (create, adopt, inspect, update, version, delete) and puts them behind five phases: survey, classify, confirm, apply, verify. Confirm is the gate the old gateway lacked; classify is where "this is repo-private tooling, not a plugin" gets decided before anything is offered.

Three additions come with it:

- `scripts/init.mjs` runs `plugin init` from the CLI shipped beside the skill, so a scaffold needs no network fetch.
- `references/vendors/<vendor>.md` — one file per runtime, read only when that runtime is enabled, replacing the vendor columns the create reference carried inline.
- `references/frontmatter.md` documents `invocation-policy`, including the part that surprises people: the build rewrites the authored `SKILL.md` to carry the derived flags.

The create reference also no longer claims `plugin build` is unavailable — it has shipped, and the reference now names its flags and the warnings worth reading.
