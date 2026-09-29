# Reference Chain Depth Reliability — Conclusion

**Status:** Pilot result. Directional, not statistically powered — treat as "no evidence found," not "proven safe."

## Decision

Do not restrict skill-authoring guidance to "avoid deep reference chains" out of fear that agents
silently drop a deep hop. In this pilot, hop depth (1, 2, 3, or 5 files deep from `SKILL.md`) had no
measurable effect on whether the chain was followed, across a fresh context, a context padded with
~80–110k tokens of irrelevant filler, and a context carrying ~138–202k tokens of accumulated
conversation (via a forked session). 40/40 trials opened every file in the chain, including all
five-hop trials. 39/40 trials produced the exact required output; the one miss was a content
transcription slip (an extra character when reversing a 10-character token), not a skipped or
ignored hop, and it happened at depth 2, not the deepest chain tested — depth 5 was perfect across
every condition and both models.

The agentskills.io "keep file references one level deep… avoid deeply nested reference chains"
guidance (see [[skill-description-guidelines]] for the sibling spec-reading exercise) is still worth
following — a shallow chain is easier for a human author to audit and reason about — but this pilot
found no evidence that a chain up to 5 hops deep causes agents to stop short. The risk that guidance
is protecting against did not reproduce here.

## What was tested

| Axis | Values |
|---|---|
| Hop depth | 1 (inline), 2, 3, 5 (`SKILL.md` → `references/step1.md` → … → `references/step<n-1>.md`) |
| Context condition | fresh (empty), small/padded (~80–250k tokens of filler read first), large (fork of an active session, ~138–202k tokens already in context) |
| Model | Sonnet 5 (full 4×3×3 matrix, 3 trials/cell = 36 runs), Opus 5 (spot check, 1 trial/depth at fresh, 4 runs) |

Each trial pointed an agent at a `procedure.md` (a stand-in for a triggered `SKILL.md`) whose final
hop carried a random, unguessable token and a required transform (reverse the string, reply with one
exact line). Success requires both reaching the final file *and* performing the transform — so the
three-way read/process outcome (never reached the value; reached it but mishandled it; reached and
correctly used it) is distinguishable from the final answer alone.

## Results

| Condition | Depth 1 | Depth 2 | Depth 3 | Depth 5 |
|---|---|---|---|---|
| Fresh (Sonnet 5) | 3/3 | 3/3 | 3/3 | 3/3 |
| Small/padded (Sonnet 5) | 3/3 | 3/3 | 3/3 | 3/3 |
| Large/fork (Sonnet 5) | 3/3 | 2/3 (1 transcription slip) | 3/3 | 3/3 |
| Fresh (Opus 5, n=1) | 1/1 | 1/1 | 1/1 | 1/1 |

39/40 correct. The one miss (large/fork, depth 2, trial 1) opened both files in the chain — it read
the correct token — but reported an 11-character result for a 10-character reversal, i.e. a
processing error on a correctly-retrieved value, not a hop that went unread. The depth-5 chain (four
reference hops past the entry file) was perfect: 10/10 across all three context conditions and both
models, with no sign that the extra hops degraded traversal.

## Caveats (read before generalizing)

- **Sample size is small.** 3 trials/cell is enough to see a stark pattern (0/3 vs 3/3), not to
  resolve close rates. Treat "0 failures out of 27" as "no signal found at n=3," not "0% failure
  rate."
- **"Large" context was ~138k tokens, not ~1M.** Forking reuses this session's *actual* accumulated
  context, which was nowhere near 1M tokens at the time of the run. A genuine 1M-token stress test
  was out of scope for this pass (it would require building that context from scratch for a fresh
  agent, which defeats the point of using a fork to save cost) and is a real gap if the 1M regime
  matters to you specifically.
- **This tests hop-traversal, not skill activation.** Trials told the agent directly "a skill has
  been activated; its entry file is at `<path>`" — bypassing the real description-matching trigger
  mechanism a runtime uses to decide which skill to load in the first place. Whether a skill
  *activates* is a separate question from whether, once activated, its reference chain gets fully
  read.
- **The task was a clean, mechanically-checkable action** (reverse a token, one required output
  line), not a fuzzy real-world procedure. Depth effects might behave differently on a task where
  "did you follow the instruction" is harder to define or where intermediate hops carry competing
  or contradictory guidance.
- **Chains beyond 5 hops were not tested.** Nothing here says a 10-hop chain is safe; the depth-5
  result is the deepest evidence this pilot has, not a ceiling that was probed until it broke.
- **Opus 5 was only spot-checked at the fresh condition** (1 trial/depth) — not against padded or
  large context, since fork forces the orchestrator's own model (Sonnet 5) and building an
  equivalent large context for Opus separately would have reintroduced the cost this pilot was
  trying to avoid.

## Key insight

The failure mode "read the wrong/no value because a hop was skipped" did not show up at all in this
pilot, not even at 5 hops; the one defect found was "read the right value, mishandled it slightly" —
a different problem (processing accuracy under context load) than the one the "avoid deep chains"
guidance is aimed at (chains going unread). If reference-chain depth is a real reliability concern,
this pilot didn't locate it at up to 5 hops; a larger, harder-task follow-up would be needed to find
it, if it exists.
