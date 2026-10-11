---
"universal-plugin": minor
---

`plugin build` warns on a relative Markdown link in a skill that climbs out of the skill folder (`../../readme.md`). pnpm links or copies each skill folder on its own, so such a link resolves to nothing there. `doctor` reports it as `skill-link-escapes`.
