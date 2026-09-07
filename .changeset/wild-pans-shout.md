---
'universal-plugin': patch
---

`init`: adoption no longer drops Copilot CLI's non-spec root fields in silence.

A pre-0.6 project's root `plugin.json` *was* Copilot CLI's derived manifest, so it carries fields
like `category` and `tags` that the closed Agent Plugins Spec field set cannot hold. The adopt route
now enumerates every non-spec field on the pre-adoption root manifest and reports it by name and
value before overwriting the file, and the losslessness diff includes root `plugin.json` — the one
vendor manifest that can lose fields, and the one the proof used to skip.
