---
title: publish-plugin
description: List an already-packaged plugin in a shared marketplace repository by opening a pull request.
---

Adds an already-packaged plugin to a marketplace repository (`cyberuni/marketplace` by default) by
opening a pull request that updates every vendor marketplace file the repository carries.

Listing a plugin in a shared repository is not the only way to distribute it: a repository can carry
its own catalog and let users add it directly as a marketplace. That is the [`marketplace`
skill](../marketplace/); the two compose, and neither replaces the other.

## The four steps

1. **Locate** — work out which of the two repos in play (the plugin, and the marketplace) the
   current directory is, rather than assuming.
2. **Pre-flight** — validate the plugin's `plugin.json` carries the required metadata, that each
   targeted vendor manifest exists and passed `plugin build`, and that any shipped skills have valid
   frontmatter. Nothing proceeds until every check passes.
3. **Prepare entries** — build the entry for each vendor marketplace file that exists. The source
   shape (`url`, `github`, `git-subdir`, or `npm`) is decided from how the plugin actually ships —
   a monorepo subdirectory needs `git-subdir`, not a root-clone `url` that resolves nothing — and
   `marketplace validate` checks the drafted entries before anything is committed.
4. **Submit PR** — one pull request that updates every detected marketplace file, with a checklist
   covering the vendor manifests, hook casing, version format, and license identifier.

## Common failure modes

| Problem | Fix |
|---|---|
| Hook events silently don't fire | Re-run `plugin build`; check its warnings for a handler type that vendor cannot run |
| Codex rejects manifest | `version` and `description` are required by Codex |
| Entry installs nothing for a monorepo plugin | Source was `url`/root-clone instead of `git-subdir` |
| `marketplace validate` fails | Fix the reported shape before opening the PR |

## See also

- [`marketplace`](../marketplace/) — the repository's own catalog, distinct from a shared marketplace listing
- [Local marketplace](../../cli/marketplace/) — the `marketplace validate` command this skill runs before opening a PR
