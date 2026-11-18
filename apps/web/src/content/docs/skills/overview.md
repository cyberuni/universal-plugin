---
title: Skills
description: The skills universal-plugin ships and what each one owns.
---

The npm package ships ten skills. They are the main way to work with universal-plugin — each owns
one job in the life of a plugin, from scaffolding it through publishing it, and the CLI underneath
it is there for scripting and CI, not the primary interface. In Claude Code they are invoked as
`/universal-plugin:<name>`; other runtimes match them against your request.

## Authoring a plugin

Five skills cover the life of a plugin. Each is scoped by the thing it touches, which is what keeps
them from competing for the same request.

| Skill | Owns |
|---|---|
| [`init-universal-plugin`](../init-universal-plugin/) | what the manifest declares |
| [`doctor-universal-plugin`](../doctor-universal-plugin/) | nothing; it only reads |
| [`version`](../version/) | the released number |
| [`build-plugin`](../build-plugin/) | the derived manifests, written |
| [`remove-plugin`](../remove-plugin/) | the artifacts, deleted |

Exactly one of them writes the canonical `plugin.json`. That is `init-universal-plugin`.

## Distribution

| Skill | Use it to |
|---|---|
| [`marketplace`](../marketplace/) | generate the catalogs that let users install from this repository, and write the README install section |
| [`migrate-plugin`](../migrate-plugin/) | move a repository-root plugin into the npm package that ships it |
| [`publish-plugin`](../publish-plugin/) | list a packaged plugin in the shared marketplace repository |
| [`upgrade-plugin`](../upgrade-plugin/) | bump the pinned `universal-plugin@<version>` a project calls |
| [`adopt-upx`](../adopt-upx/) | rewrite `npx` pins in your skills to the `upx` runner |

`upgrade-plugin` moves the version your project *calls*. `version` moves the version your plugin
*publishes*. They are different numbers.

## Bundled scripts

`init-universal-plugin`, `doctor-universal-plugin`, `version`, `build-plugin`, `marketplace`,
`publish-plugin`, and `remove-plugin` each ship scripts in their own `scripts/` directory.
`plugin build` compiles each standalone script into a single self-contained `.mjs` and writes each CLI
forwarder, so each works when pnpm links the skill, when it copies the skill folder on its own, and
from a git-sourced install.

```sh
node scripts/doctor.mjs
```

A skill that runs the CLI calls `scripts/universal-plugin.mjs`, a forwarder that runs the CLI of the
checkout it sits in, else the release pinned to the skill's version through `npx`. For your own
plugin, declare a forwarder and call it with `node`: see
[Running the plugin's own CLI from a skill](../../cli/build/#running-the-plugins-own-cli-from-a-skill).

## Why four skills and not one

The authoring four started as a single gateway skill with a route table. No one name covered create,
adopt, update, inspect, version, and delete, and one description that has to match all six matches
each of them weakly.

The rule that replaced it: a new verb earns a route on the skill whose object it shares, and a skill
of its own only when its object differs. Competing writers on one object are what fragments a
surface, not the number of skills.
[ADR-0009](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0009-split-the-plugin-gateway-skill.md)
records the decision.
