---
title: Skills
description: The skills universal-plugin ships, what each one owns, and which CLI verb it fronts.
---

The npm package ships nine skills. Each one is the interactive front end to a CLI verb, or to a
workflow that spans several. In Claude Code they are invoked as `/universal-plugin:<name>`; other
runtimes match them against your request.

## Authoring a plugin

Four skills cover the life of a plugin. Each is scoped by the thing it touches, which is what keeps
them from competing for the same request.

| Skill | Owns | Fronts |
|---|---|---|
| [`init-universal-plugin`](../init-universal-plugin/) | what the manifest declares | `plugin init`, `plugin build` |
| [`doctor-universal-plugin`](../doctor-universal-plugin/) | nothing; it only reads | `plugin build --dry-run` |
| [`version`](../version/) | the released number | `plugin version`, `publish sync-version` |
| [`remove-plugin`](../remove-plugin/) | the artifacts | `plugin build --clean` |

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

## Bundled launchers

`init-universal-plugin`, `doctor-universal-plugin`, `version`, and `marketplace` each ship a launcher
in their own `scripts/` directory. The launcher
imports the CLI that shipped beside it, so a scaffold or a diagnosis needs no network fetch and
cannot resolve a different version than the one you installed.

```sh
node scripts/doctor.mjs
```

Every skill body keeps a pinned `npx` fallback for the case where the path cannot be resolved. See
[Running a CLI your own plugin ships](../../concepts/npx-and-upx/#running-a-cli-your-own-plugin-ships)
for the four requirements that make the pattern work.

## Why four skills and not one

The authoring four started as a single gateway skill with a route table. No one name covered create,
adopt, update, inspect, version, and delete, and one description that has to match all six matches
each of them weakly.

The rule that replaced it: a new verb earns a route on the skill whose object it shares, and a skill
of its own only when its object differs. Competing writers on one object are what fragments a
surface, not the number of skills.
[ADR-0009](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0009-split-the-plugin-gateway-skill.md)
records the decision.
