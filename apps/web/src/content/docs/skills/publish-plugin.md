---
title: publish-plugin
description: Publish a plugin's current version to a shared marketplace repository by opening a pull request, adding the plugin or moving its listing to the new release.
---

Publishes a plugin's current version to each target marketplace repository (the one you name, else
the plugin's `marketplaces` config, else `cyber-uni/marketplace`) by opening a pull request that updates every vendor marketplace file the repository carries. It
works like `npm publish`: a plugin the marketplace does not list is added, one listed at an older
version is moved to the new release in place, and one already listed at this version is left alone
with a note saying so. "Publish", "release to the marketplace", and "publish the new version" are
all the same request.

Listing a plugin in a shared repository is not the only way to distribute it: a repository can carry
its own catalog and let users add it directly as a marketplace. That is the [`marketplace`
skill](../marketplace/); the two compose, and neither replaces the other.

## The four steps

1. **Locate** — work out which of the two repos in play (the plugin, and the marketplace) the
   current directory is, rather than assuming. With only read access to the marketplace, the skill
   also reads its workflows and Contributing section. A curated catalog that closes outside pull
   requests (for example `anthropics/claude-plugins-official`) gets a drafted entry and the
   submission link instead of a PR.
2. **Pre-flight** — validate the plugin's `plugin.json` carries the required metadata, that each
   targeted vendor manifest exists and passed `plugin build`, and that any shipped skills have valid
   frontmatter. It also resolves the release the version points at, a tag such as
   `<name>@<version>` or the npm version, and stops if that release does not exist. Nothing
   proceeds until every check passes.
3. **Prepare entries** — read how each vendor marketplace file lists the plugin and decide: add it,
   move an older listing to this release with `marketplace update` (the `ref`/`sha` pin or version,
   and changed fields, keeping curator fields), or do nothing when it is already at this version.
   For an add, build the entry. The source
   shape (`url`, `github`, `git-subdir`, or `npm`) is decided from how the plugin actually ships —
   a monorepo subdirectory needs `git-subdir`, not a root-clone `url` that resolves nothing — and
   `marketplace validate` checks the drafted entries before anything is committed. The plugin's
   declared dependencies are read here too. A plain dependency (a bare name, or an object with no
   `marketplace`) resolves against the target marketplace. If that marketplace does not list it, the
   skill lists it in the same PR, prepared from its own repository or package. If it cannot, the
   skill stops and asks you to publish it first. A dependency that names a different marketplace
   needs the target catalog's `allowCrossMarketplaceDependenciesOn`, which the skill offers to add.
4. **Submit PR** — one pull request per marketplace that updates every detected marketplace file, with a checklist
   covering the vendor manifests, hook casing, version format, and license identifier.

## Common failure modes

| Problem | Fix |
|---|---|
| Hook events silently don't fire | Re-run `plugin build`; check its warnings for a handler type that vendor cannot run |
| Codex rejects manifest | `version` and `description` are required by Codex |
| Entry installs nothing for a monorepo plugin | Source was `url`/root-clone instead of `git-subdir` |
| Install fails resolving a dependency | List a plain dependency in the same marketplace, or allow a named marketplace in `allowCrossMarketplaceDependenciesOn` |
| `marketplace validate` fails | Fix the reported shape before opening the PR |
| Entry installs nothing after a release | The pin names a tag that was never pushed; release and push it first |
| PR closed automatically as soon as it opened | The target is curated; use its submission route instead of a PR |

## See also

- [`marketplace`](../marketplace/) — the repository's own catalog, distinct from a shared marketplace listing
- [Local marketplace](../../cli/marketplace/) — the `marketplace validate` command this skill runs before opening a PR
