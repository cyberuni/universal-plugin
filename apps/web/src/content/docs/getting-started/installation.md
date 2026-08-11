---
title: Installation
description: How to install and run universal-plugin.
---

## Run without installing

Always pin to an exact version in scripts and hooks — never use `@latest`:

```bash
# Explore (one-off)
npx universal-plugin@latest --help

# Scripts and CI (pin to current version)
npx universal-plugin@$(npm view universal-plugin version) build
```

## Install globally

```bash
npm install -g universal-plugin
universal-plugin build
```

## Fast repeated calls: upx

`npx` re-resolves and re-spawns on every call — roughly 1s of overhead each time, even when the
package is already cached. If a skill or script calls a CLI many times, that adds up. `upx` is a
second bin shipped by this package that finds an already-installed version satisfying a semver
range and runs it directly, about 10× faster, falling back to `npx` when nothing local matches:

```bash
npm i -g universal-plugin   # installs the upx bin alongside universal-plugin

upx cyber-skills@^2 audit validate
```

Use a caret range (`@^2`), not an exact pin — that's what lets one global install serve every
caller at that major. `upx` only exists once installed; `npx` ships with npm by default, so keep
using `npx` for environments where `universal-plugin` isn't installed globally.

## Install as a dev dependency

```bash
npm install --save-dev universal-plugin
# or
pnpm add -D universal-plugin
```

Then use it from `package.json` scripts:

```json
{
  "scripts": {
    "build:plugin": "universal-plugin build",
    "postinstall": "universal-plugin build"
  }
}
```

## Requirements

- Node.js >= 22
- A `plugin.json` at the plugin root (see [Introduction](../introduction/))
