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
npx universal-plugin@$(npm view universal-plugin version) plugin build
```

## Install globally

```bash
npm install -g universal-plugin
universal-plugin plugin build
```

## Fast repeated calls: upx

`upx` runs an already-installed CLI matching a semver range instead of resolving one on every call.
It ships as its own package:

```bash
npm i -g @repobuddy/upx

upx cyber-skills@^2 audit validate
```

Use a caret range (`@^2`), not an exact pin. That is what lets one global install serve every caller
at that major. `upx` only exists once installed, so keep `npx` anywhere you cannot guarantee the
global install. [Choosing a runner](../../concepts/npx-and-upx/) covers when to reach for which runner.

:::caution[Deprecated]
`universal-plugin` still installs a `upx` bin that re-exports `@repobuddy/upx`, so existing global
installs keep working. It will be removed in the next major.
:::

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
    "build:plugin": "universal-plugin plugin build",
    "postinstall": "universal-plugin plugin build"
  }
}
```

## Requirements

- Node.js >= 22
- A `plugin.json` at the plugin root (see [Introduction](../introduction/))
