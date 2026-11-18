---
"universal-plugin": minor
---

A skill runs a CLI through one forwarding script per CLI (ADR 0022). Declare `"skills/<skill>/scripts/<bin>.mjs": { "forward": "<bin>" }` under `extensions["org.cyberuni.universal-plugin"].scripts`, and `plugin build` writes a small `.mjs` the skill calls with `node <this skill's folder>/scripts/<bin>.mjs <args>`. In a checkout of the package it runs the checkout's bin with `node`, and warns when `dist/` is older than `src/`. Anywhere else it runs `npx -y <pkg>@<version>`, with the version from `plugin.json`. `plugin build --check` reports a forwarder `missing`, `stale` or `version`, `plugin version` restamps it, and `publish check-version` compares it. A CLI from another package pins its version in the entry (`"package"`, `"version"`), and neither the stamp nor the drift check moves it.

`doctor-universal-plugin`'s `own-package-runner` now reads `pnpm exec <bin>` as well as `npx` and `upx`, and its repair is the `forward` entry to declare. A new `runner-beside-forwarder` finding flags a runner line in a skill that already has a forwarder for that CLI. `init-universal-plugin` gains an "add a CLI forwarder" route. universal-plugin's own skills run its CLI through `scripts/universal-plugin.mjs`, replacing `build.mjs`, `init.mjs`, `version.mjs`, `add.mjs`, `marketplace.mjs`, `update.mjs` and `validate.mjs`.
