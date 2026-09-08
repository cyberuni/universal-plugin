---
'universal-plugin': patch
---

`init`: adoption no longer drops Copilot CLI's non-spec root fields in silence.

A pre-0.6 project's root `plugin.json` *was* Copilot CLI's derived manifest, so it carries fields
like `category` and `tags` that the closed Agent Plugins Spec field set cannot hold. The adopt route
now enumerates every non-spec field on the pre-adoption root manifest and reports it by name and
value before overwriting the file, and the losslessness diff includes root `plugin.json` — the one
vendor manifest that can lose fields, and the one the proof used to skip.

`references/vendors/copilot-cli.md` now records what is actually known about `category` and `tags`:
Copilot CLI documents both as manifest fields, nothing in its documentation consumes either, and the
Agent Plugins Spec bars a conformant client from assigning unknown fields meaning — so dropping them
costs nothing observable. What remains unestablished is written down as open questions rather than
guessed at.

The field-sorting table also routes a pre-0.6 top-level `vendorExtensions` block explicitly: it is
the old name for `harnesses`, not an undeliverable field, and dropping it would discard every
per-harness override the project had.

The Copilot CLI reference is now settled against the shipped runtime rather than the vendor's field
table: `category` and `tags` have no `plugin.json` handling at all in Copilot CLI 1.0.83 — the
manifest validator treats them as unknown-and-ignored — and are real only on a `marketplace.json`
catalog entry. Adoption therefore folds them into `keywords`, a spec field the validator does know,
instead of dropping them.
