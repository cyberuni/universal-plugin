---
"universal-plugin": minor
---

`plugin build` adds the pnpm skill name beside each `/<plugin>:<skill>` reference in a skill's Markdown: `` `/my-plugin:doctor` (pnpm install: `pnpm-my-plugin-doctor`) ``. pnpm links a skill as `pnpm-<package>-<skill>` (a scoped `@scope/name` becomes `pnpm-@scope+name-<skill>`), so the plugin-qualified name alone resolves to nothing there. Authors still write the reference once. The name comes from the plugin root's `package.json`; references to other plugins or unknown skills, fenced code, and already-rewritten references are left alone.
