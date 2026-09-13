---
"universal-plugin": patch
---

`schema/extension.schema.json` and the `init-universal-plugin` standard reference no longer advertise `packagePath` under `extensions["org.cyberuni.universal-plugin"]`. The CLI never read it there, so a plugin that declared it where the schema said silently fell back to the author-picks release model. `packagePath` lives in `.agents/universal-plugin.json` beside `plugin.json`, as a path relative to the plugin root; a namespace `packagePath` now fails schema validation.
