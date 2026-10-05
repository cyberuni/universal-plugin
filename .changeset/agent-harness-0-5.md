---
'universal-plugin': patch
---

Depend on `@cyberuni/agent-harness` `^0.5.0`. That release ships the `agent-harness` CLI, so `npx @cyberuni/agent-harness reference show <name>` reads this package's documents without a version pin.
