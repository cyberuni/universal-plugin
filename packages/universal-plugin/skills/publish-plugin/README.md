# publish-plugin skill

List an already-packaged plugin in a shared marketplace repository by opening a pull request against
its vendor catalogs.

## What it does

Four steps: locate the plugin and the marketplace, validate the plugin is ready, prepare the entry
for each vendor catalog that exists, then open one PR that updates all of them together.

## Two repos, either one could be the cwd

The plugin being published and the marketplace it is going into are different repos, and the current
working directory could be either. The skill checks the cwd's remote against the target marketplace
repo (`cyberuni/marketplace` by default) before doing anything else:

- cwd is the plugin → the marketplace repo gets cloned or forked, as it always did.
- cwd is already the marketplace → work happens in place; the plugin's metadata is read from wherever
  the user points to instead (a local path, or a URL cloned to a scratch directory).

Every check and every entry field in Steps 1–2 reads from the plugin location this step finds, never
from the cwd by assumption. Getting this wrong means the marketplace entry ends up pointing at the
marketplace repo's own URL instead of the plugin's.

## Why this is not the `marketplace` skill

`marketplace` generates a repository's own local catalog — no submission, no shared listing, no PR.
This skill is the opposite case: putting a plugin into someone else's shared catalog, which only a
pull request can do. They compose rather than overlap: a plugin can have both a local catalog for
`git clone`-and-go installs and a listing here.

## References

- [Spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md)
- `references/vendor-requirements.md` — required fields and hook casing rules per runtime
