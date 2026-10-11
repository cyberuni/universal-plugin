---
"universal-plugin": minor
---

`plugin build` compiles skill script entries into self-contained `.mjs` files. Declare them under `extensions["org.cyberuni.universal-plugin"].scripts`, mapping an output path to a source (`"skills/doctor/scripts/doctor.mjs": "src/skills/doctor.ts"`, or `{ "source", "command" }`). Each entry is compiled with rolldown: Node built-ins stay imports and everything else is inlined, so the script works from a skill that pnpm links or copies on its own. Commit the output.

- Each compiled file embeds `globalThis.__SKILL_SCRIPT__`: the package and bin that ship the plugin, the version from `plugin.json`, and a map from every declared command path to its entry.
- `--dry-run` reports each committed script as `unchanged`, `missing`, `stale` or `version`. `doctor` reports a missing or stale one as `stale-script`. A script behind only on its embedded version is `version-drift`, which `publish check-version` now checks, so one file is never reported twice.
- A compiled script over 150 KB warns that the skill should call the installed CLI instead.
- `plugin version` stamps the new version into each compiled script's header, and nothing else in it. Pins inside compiled code are left to the build.
