---
"universal-plugin": minor
---

`plugin build` now translates hooks per vendor instead of copying the canonical declaration through
unchanged. Cursor gets a derived `hooks.json` beside its manifest with camelCase event names, the
schema version it expects, and matcher groups flattened into its handler list; Claude Code, Codex,
and Copilot CLI read the canonical PascalCase file as authored.

A handler the target vendor cannot run — `http` on Cursor, anything but `command` on Codex, `agent`
on Copilot CLI — is dropped from that vendor's file and warned about, one warning per event and
handler type, and the build stays green (ADR-0011). A vendor left with no runnable hook at all gets
no derived file and no `hooks` field.
