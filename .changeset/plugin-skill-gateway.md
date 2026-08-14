---
'universal-plugin': patch
---

Restructure the `plugin` skill as a gateway. The Create, Inspect, Update, and Delete procedures
moved out of `SKILL.md` into `references/create.md`, `references/inspect.md`,
`references/update.md`, and `references/delete.md`. `SKILL.md` now carries only the trigger,
prerequisites, and a routing table, so an agent loads one operation's procedure instead of all four.
