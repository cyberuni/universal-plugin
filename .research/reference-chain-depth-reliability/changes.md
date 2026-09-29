# Changes

## 2026-09-18 — Initial pilot

Opened to test whether the agentskills.io "avoid deeply nested reference chains" guidance is
protecting against a real, observable failure mode (agents silently stopping short of a 2nd or 3rd
hop) versus a theoretical one. Ran a 27-trial matrix (3 depths × 3 context conditions × 3 trials)
on Sonnet 5, plus a 3-trial Opus 5 spot check at the fresh condition, using randomly-tokened fixture
chains and a mechanically-checkable required transform. Found no depth-linked failures; found one
context-processing slip under the large/fork condition, at depth 2, unrelated to hop traversal.
Result recorded as a pilot, not a settled rate, per the caveats in `conclusion.md`.

## 2026-09-18 — Depth-5 follow-up

Extended the same method to a 5-hop chain (four reference hops past the entry file) to check
whether a failure mode would appear further out than depth 3. Ran 9 more Sonnet 5 trials (3 fresh +
3 small/padded + 3 large/fork) and 1 more Opus 5 spot-check trial, reusing the existing filler
document and adding new known/blind fixture sets for depth 5. All 10 trials opened every file in the
chain and produced the exact correct output — including the large/fork trials, which by this point
carried ~202k tokens of inherited context, more than any earlier cell. Updated all four files with
the combined 40-trial result; the headline conclusion is unchanged (no depth-linked failure found),
now extended through depth 5.
