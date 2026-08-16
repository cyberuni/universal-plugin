---
"universal-plugin": patch
---

Stop deriving `.cursor/commands/*.md` mirrors of skills

The build wrote a copy of every user-invocable skill body to
`<root>/.cursor/commands/<name>.md`. Cursor does not need it: a plugin's
`skills` path is loaded directly, and a user invokes a skill by typing `/` and
searching for it. Cursor also expresses explicit-only invocation natively with
`disable-model-invocation`, which the build already writes into SKILL.md — so the
mirror was a redundant second copy of the same content, dropped into the plugin's
own working tree.
