# publish-plugin skill

Publish a plugin's current version to a shared marketplace repository by opening a pull request
against its vendor catalogs, the way `npm publish` puts the version in `package.json` into the
registry.

## What it does

Four steps: locate the plugin and the marketplace, validate the plugin is ready and that its
release exists, decide per catalog whether to add, update, or leave the listing, then open one PR
per marketplace that updates all of its catalogs together.

## Publishing is add-or-update

A first listing and a new version are one request. The skill reads the version in `plugin.json`,
resolves its release (a tag such as `<name>@<version>`, or the npm version), and stops if that
release does not exist, so no entry is pinned to a ref nobody can fetch. Then, per catalog:

- not listed → the entry is added;
- listed at an older version → `marketplace update` moves its `ref`/`sha` pin or version and the
  changed fields in place, keeping curator fields;
- listed at this version → nothing changes, and the skill says so, the way `npm publish` refuses to
  republish a version.

## Where it publishes

The target is the marketplace the user names, else the `marketplaces` array in the plugin's
`.agents/universal-plugin.json` (one PR per entry), else `cyber-uni/marketplace`. The skill states
which rule picked the target before it opens anything, so a wrong target shows up early. Nothing
else in the plugin records where it publishes, so without the config every request has to restate
the target.

## Two repos, either one could be the cwd

The plugin being published and the marketplace it is going into are different repos, and the current
working directory could be either. The skill checks the cwd's remote against the target marketplace
repo before doing anything else:

- cwd is the plugin → the marketplace repo gets cloned or forked, as it always did.
- cwd is already the marketplace → work happens in place; the plugin's metadata is read from wherever
  the user points to instead (a local path, or a URL cloned to a scratch directory).

Every check and every entry field in Steps 1–2 reads from the plugin location this step finds, never
from the cwd by assumption. Getting this wrong means the marketplace entry ends up pointing at the
marketplace repo's own URL instead of the plugin's.

## A plugin's dependencies go with it

A plain dependency (no marketplace named) resolves against the marketplace the plugin is installed
from, so publishing a plugin whose plain dependency the catalog does not list publishes something
nobody can install. The skill lists such a dependency in the same PR, or stops and asks for it to be
published first. A dependency that names another marketplace only needs that marketplace in the
catalog's `allowCrossMarketplaceDependenciesOn`, which the skill offers to add.

## Some marketplaces take no pull requests

A curated directory, such as `anthropics/claude-plugins-official`, closes pull requests from
outsiders and takes new plugins through a form. When the user has only read access to the target,
the skill reads its workflows and Contributing section live, and, if it is curated, drafts the entry
in the catalog's own shape and hands over the submission link instead of opening a PR. It checks
each time rather than storing the catalog's rules, because those rules change.

## Why this is not the `marketplace` skill

`marketplace` generates a repository's own local catalog — no submission, no shared listing, no PR.
This skill is the opposite case: putting a plugin into someone else's shared catalog, which only a
pull request can do. They compose rather than overlap: a plugin can have both a local catalog for
`git clone`-and-go installs and a listing here.

## References

- [Spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md)
- `references/vendor-requirements.md` — required fields and hook casing rules per runtime
