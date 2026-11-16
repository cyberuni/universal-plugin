## Plugin

**Name:** <plugin-name>
**Version:** <version>
**Author:** <author>
**License:** <license>
**Category:** <category>

## Description

<description>

## Runtimes

- [x] Claude Code
- [x] Cursor
- [ ] Codex  (no marketplace file)
- [ ] GitHub Copilot CLI  (no marketplace file)

## Marketplace files changed

- `.claude-plugin/marketplace.json` — added | moved from v<old-version>
- `.cursor-plugin/marketplace.json` — added | moved from v<old-version>

## Links

- Homepage: <homepage>
- Repository: <repository>

## Checklist

- [ ] All targeted vendor manifests present and valid
- [ ] `plugin build` ran, and its dropped-handler warnings were read
- [ ] Semver version string
- [ ] Release `<tag>` (or npm version) exists, and every pin names it
- [ ] SPDX license identifier
- [ ] Entry added or moved to this version in each detected marketplace file
- [ ] Every plain dependency is listed in this marketplace (here or already)
- [ ] Every marketplace a dependency names is in `allowCrossMarketplaceDependenciesOn`, or noted as not needed
