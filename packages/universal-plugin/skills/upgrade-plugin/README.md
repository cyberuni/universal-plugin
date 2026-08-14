# upgrade-plugin skill

Upgrades all pinned `universal-plugin@<version>` calls across a project to the latest or a specific version — recognizes both `npx universal-plugin@<version>` and `upx universal-plugin@<version>` (see the `adopt-upx` skill), preserving whichever runner word each reference already uses.

## When to use

When you need to bump the `universal-plugin` version pin in hook files, SKILL.md files, docs, or any other project files.

## What it does

1. Resolves the target version (latest from npm, or user-supplied semver)
2. Finds every `npx universal-plugin@<version>` and `upx universal-plugin@<version>` occurrence across the project
3. Confirms the replacement plan with the user
4. Applies changes using the Edit tool (reviewable diffs), keeping each reference's runner word (`npx` or `upx`) unchanged
5. Verifies no old pins remain, then commits

Cross-major bumps require explicit confirmation.

## Install

```bash
npx skills add cyberuni/universal-plugin --skill upgrade-plugin
```
