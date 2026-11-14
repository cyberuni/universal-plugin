---
'universal-plugin': patch
---

`init-universal-plugin` now writes and audits skills with the `skill` skill in `cyber-agentkit`, the plugin's declared dependency, instead of aced's `improve-skill`, which a session without aced installed could not run.
