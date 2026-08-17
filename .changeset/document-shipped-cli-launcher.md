---
'universal-plugin': patch
---

Document how a skill runs a CLI its own plugin ships.

The npx-and-upx page already named importing in-process as the only complete fix for the runner's cost, and put it at the top of the "choosing a runner" table. It did not say how a skill reaches that code when the skill file and the package both sit in a plugin cache.

It now records the launcher pattern: a script in the skill's own `scripts/` directory that resolves the package from `import.meta.url` and imports the bin, invoked as `node scripts/<name>.mjs`. Four requirements come with it, each with its own failure mode: resolve from the script rather than the working directory, keep `node` in front of a file that ships without an executable bit, publish to npm when the CLI has dependencies, and keep a pinned `npx` fallback that is regenerated at release.
