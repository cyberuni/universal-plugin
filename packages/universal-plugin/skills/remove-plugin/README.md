# remove-plugin skill

Remove a universal plugin's artifacts — from cleaning a build output to taking the plugin out of a
project entirely.

## Three removals, not one

They are not equally reversible, and the skill establishes which one is being asked for before
deleting anything:

| Ask | Removes | Reversible by |
| --- | --- | --- |
| clean the build output | derived vendor manifests | `plugin build` |
| drop a vendor | one manifest, and its declaration | re-adding the vendor, then a build |
| remove the plugin | the canonical manifest and every component | nothing |

Only the last is irreversible, and only it needs a confirmation.

## What it will not do

Root `plugin.json` is never deleted as cleanup. It is the canonical source of truth *and* the
manifest GitHub Copilot CLI reads, so removing it takes out the source and a live target at once.

Dropping a vendor is a manifest edit first: deleting only the file leaves the vendor declared, and
the next build writes it straight back. That edit routes to `init`.

Deleting a published plugin's source does not unpublish it. The skill says so rather than implying
the removal reached consumers.

## Why there is no delete script

`plugin build --clean` already removes exactly what the manifest declares and nothing it does not.
Anything beyond that is a judgment call about authored content, which is the part that should stay
in front of a human.

## References

- [Spec](https://github.com/cyberuni/universal-plugin/blob/main/packages/universal-plugin/.agents/spec/spec.md)
