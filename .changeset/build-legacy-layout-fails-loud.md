---
"universal-plugin": minor
---

`plugin build` now separates "nothing was declared" from "this layout is one I cannot read".

A repository left on the pre-0.6 layout — a top-level `vendorExtensions` block, or a
`.plugin/plugin.json` shadowing the canonical manifest — derives nothing, and until now that was
reported as a definitive empty state: `built 0`, exit 0. Chained behind a release script it read as
success, and a released version silently never reached the vendor manifests.

Deriving nothing from a canonical manifest that genuinely declares no harnesses is still an empty
result (exit 0), and its stderr now names `/universal-plugin:doctor` as the next step rather than
`plugin validate`, which has nothing to say about it. Deriving nothing because the layout predates
this CLI is a failed read: the build exits 1, names the signal it found, and points at `doctor`. The
check only fires where the target set was already empty, so a project carrying one of those signals
whose harnesses still derive is unaffected.

`doctor`'s description now covers this case — `built 0`, "nothing to build", the
`No vendors declared in harnesses` warning, a major upgrade, a leftover `.plugin/plugin.json` or
`vendorExtensions` — so an agent seeing the symptom routes to the skill that diagnoses it.

Closes #61
