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
| `init` | what the manifest declares | `plugin init`, `plugin build` |
| `doctor` | nothing; it only reads | `plugin build --dry-run` |
| `version` | the released number | `plugin version`, `publish sync-version` |
| `remove-plugin` | the artifacts | `plugin build --clean` |

Exactly one of them writes the canonical `plugin.json`. That is `init`.

### init

Creates a plugin, adopts an existing one onto the open standard, or changes what an existing one
declares. It runs five phases: survey, classify, confirm, apply, verify.

The confirm phase is the one that matters. Adoption turns hand-written vendor manifests into build
output, so the skill states the plan and waits for approval before it rewrites anything you
authored. Creating a file that does not exist yet needs no approval.

Adoption is lossless by contract. After the build, `git diff` over the vendor manifest paths should
show formatting churn and nothing else. A field that disappeared is a regression.

### doctor

Diagnoses a plugin and repairs nothing. It reports what is declared, unbuilt, stale, drifting, or
shadowing, then names the skill that owns each repair.

The checks run as a script rather than a prose checklist, because they are deterministic. It emits
one JSON object:

```json
{
  "manifest": { "name": "my-plugin", "version": "1.0.0" },
  "vendors": [{ "vendor": "claude-code", "path": ".claude-plugin/plugin.json", "status": "built", "exists": true, "stale": false }],
  "findings": [{ "code": "unbuilt", "severity": "high", "detail": "…", "repair": "…" }],
  "ok": false
}
```

Exit status is `0` whether or not findings exist. A finding is a result, not a failure, so the
script is safe to run from a session-start hook.

One check stays out of the script. Comparing a derived manifest against what the build would write
today requires rebuilding on a clean tree, and that writes. `doctor` reports it as a repair for you
to run.

### version

Moves the number a plugin releases under. Its first question is whether the repository uses
changesets, because that decides who owns the number.

With changesets, the release decides it and `publish sync-version` carries it into the canonical
manifest. Without changesets, `plugin version <bump>` does the whole move. Running `plugin version`
in a changesets repository would pick a number changesets is about to pick again.

Which release type to use is not the skill's call. A version is a promise about what broke, so the
skill offers the semver reading and asks.

### remove-plugin

Removes artifacts. Cleaning build output, dropping one vendor, and removing the plugin are three
different asks, and only the last is irreversible.

Root `plugin.json` is never deleted as cleanup. It is the canonical source of truth, and it is also
the manifest GitHub Copilot CLI reads.

## Distribution

| Skill | Use it to |
|---|---|
| `marketplace` | generate the catalogs that let users install from this repository, and write the README install section |
| `migrate-plugin` | move a repository-root plugin into the npm package that ships it |
| `publish-plugin` | list a packaged plugin in the shared marketplace repository |
| `upgrade-plugin` | bump the pinned `universal-plugin@<version>` a project calls |
| `adopt-upx` | rewrite `npx` pins in your skills to the `upx` runner |

`upgrade-plugin` moves the version your project *calls*. `version` moves the version your plugin
*publishes*. They are different numbers.

### Which runtimes a local marketplace reaches

One file carries three runtimes. Claude Code, Codex, and Copilot CLI all read
`.claude-plugin/marketplace.json`, so generating the Claude catalog is what makes a repository
installable from all three.

| Runtime | Catalog it reads | The user runs |
|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `/plugin marketplace add`, then `/plugin install` |
| Codex | `.claude-plugin/marketplace.json` | `codex plugin marketplace add`, then `codex plugin add` |
| GitHub Copilot CLI | `.github/plugin/marketplace.json`, or the Claude path | `copilot plugin marketplace add`, then `copilot plugin install` |
| Cursor | none | install from Cursor's reviewed marketplace |

Two traps are worth knowing before you write install instructions by hand. Codex installs with
`plugin add` while Copilot CLI uses `plugin install`. And Codex publishes neither verb in its
documentation, so the commands above come from the shipped CLI.

Cursor has no repository-local marketplace, so the skill produces a submission scaffold and says so
rather than implying an install path. Every command it emits carries an evidence ID in
[the research record](https://github.com/cyberuni/universal-plugin/blob/main/.research/local-marketplaces/conclusion.md).

The README section is generated from the catalogs on disk, so the marketplace name, the plugin
names, and the repository slug come from the repository rather than from a model retyping them.

## Bundled launchers

`init`, `doctor`, `version`, and `marketplace` each ship a launcher in their own `scripts/` directory. The launcher
imports the CLI that shipped beside it, so a scaffold or a diagnosis needs no network fetch and
cannot resolve a different version than the one you installed.

```sh
node scripts/doctor.mjs
```

Every skill body keeps a pinned `npx` fallback for the case where the path cannot be resolved. See
[Running a CLI your own plugin ships](../../concepts/npx-and-upx/#running-a-cli-your-own-plugin-ships)
for the four requirements that make the pattern work.

## Why four skills and not one

These four started as a single gateway skill with a route table. No one name covered create, adopt,
update, inspect, version, and delete, and one description that has to match all six matches each of
them weakly.

The rule that replaced it: a new verb earns a route on the skill whose object it shares, and a skill
of its own only when its object differs. Competing writers on one object are what fragments a
surface, not the number of skills.
[ADR-0009](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/design/decisions/0009-split-the-plugin-gateway-skill.md)
records the decision.
