---
'universal-plugin': patch
---

`init`: stop the vendor table from reading as though Copilot CLI needs nothing derived.

Copilot CLI has no derived *manifest* — that part was right. But declaring the canonical `$schema`
puts a plugin in Open Plugin Spec mode, and Copilot CLI then reads its native components (agents,
commands, rules, hooks) from a `com.github.copilot/` directory rather than the plugin root. The
table's "Extra requirements: none" cell was the inaccurate one, and it now names the requirement and
points at the issue tracking build support for it.
