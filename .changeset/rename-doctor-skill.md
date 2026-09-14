---
"universal-plugin": minor
---

Rename the `doctor` skill to `doctor-universal-plugin`. Other plugins ship their own `doctor` skill, and the bare name collided when more than one was installed — `buddy-agent-harness` already resolved this by namespacing its own as `doctor-buddy-agent-harness`. Invoke it as `/universal-plugin:doctor-universal-plugin`; the CLI's own next-step hints now name that too.
