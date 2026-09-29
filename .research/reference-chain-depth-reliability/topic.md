# Reference Chain Depth Reliability — Investigation Record

## Question

When a skill's entry file links to a reference file, which itself links to another reference file
(a "2nd hop", "3rd hop", or deeper from `SKILL.md`), how often does an agent actually follow the
chain to the end and correctly act on what it finds there — and does that rate change with the
size/fullness of the agent's context window, or with how deep the chain goes?

## Trigger

While discussing the agentskills.io "keep file references one level deep… avoid deeply nested
reference chains" guidance (see [[skill-description-guidelines]]) and whether a "gateway skill"
pattern (one `SKILL.md` dispatching to several `references/<route>.md` files) is compliant, the
open question became: is the "avoid deep chains" rule protecting against a real, observed failure
mode, or a theoretical one? Rather than reason about it further, the user asked for an empirical
test: build fixtures with multi-hop chains, run trials under fresh / near-limit-small / large
(~1M, via fork to save cost) context conditions, and check not just whether the final answer was
right but whether the agent actually *read* the deep hop versus reading it but not following its
instruction. The initial pass covered depths 1–3; a follow-up request extended the same method to a
5-hop chain to see whether a failure mode would appear further out.

## Method

### Fixtures

Two parallel fixture sets, each with four depths:

- **depth1** — `procedure.md` contains the token and the required transform inline (no further
  hop).
- **depth2** — `procedure.md` points to `references/step.md`, which contains the token and
  transform.
- **depth3** — `procedure.md` points to `references/step1.md`, which points to
  `references/step2.md`, which contains the token and transform.
- **depth5** — `procedure.md` points to `references/step1.md` → `step2.md` → `step3.md` →
  `step4.md`, the last of which contains the token and transform (four reference hops past the
  entry file). Each intermediate step file explicitly says "the actual ledger code is not in this
  file" and names the next file, to rule out the agent treating an early hop as good enough.

The required transform: take a random unguessable alphanumeric token, reverse it character by
character, reply with exactly one line (`LEDGER-RESULT: <reversed>`). This makes three outcomes
distinguishable from the final answer alone: no correct token anywhere in the answer (didn't reach
the final hop), the correct forward token present but not reversed or malformed (reached it, didn't
follow the instruction), or the correctly reversed token (reached it and followed the instruction).

A **known** set (tokens chosen directly, safe to have in the orchestrating session's own context)
was used for the fresh and small conditions, which use fresh, non-forking subagents that inherit no
context from the orchestrator. A **blind** set (tokens generated via a shell pipeline whose output
was never printed to the orchestrating session, so the value never entered that session's context)
was used for the large/fork condition, since a fork inherits the orchestrator's *entire* context —
if the answer had been visible there, the fork would have "known" it without reading anything. The
blind tokens were only revealed for scoring after every fork call had already been dispatched.

### Context conditions

- **Fresh** — a new subagent with no prior context, given only the task prompt.
- **Small/padded** — a new subagent instructed to read an ~83k-word (~110k-token) synthetic filler
  document in full before being given the task, to approximate a context that is meaningfully full
  without being at any specific model's hard ceiling.
- **Large/fork** — the orchestrating session itself, forked. A fork inherits the parent's full
  conversation context (here, ~138–139k tokens per the subagent-token usage reported back), reusing
  the prompt cache rather than paying to build a large context from scratch. This is *not* a true
  ~1M-token test; see conclusion.md's caveats.

### Models

Sonnet 5 ran the full 4 (depth) × 3 (condition) × 3 (trial) matrix = 36 runs (27 at depths 1–3, plus
9 for the depth-5 follow-up). Opus 5 ran a minimal spot check — 1 trial per depth at the fresh
condition only, 4 runs total — because a fork always inherits the *orchestrator's* model (Sonnet 5
in this session), so a genuine Opus-under-large-context trial was not obtainable via fork, and
building an equivalent large context for Opus from scratch would have defeated the cost-saving
reason for choosing fork in the first place.

### Scoring

Every trial's prompt required the agent to report back the list of files it opened (in order) plus
the required result line. This makes hop-traversal directly checkable from the returned report
without needing to inspect the subagent's raw transcript.

## Findings

All 40 trials opened every file in their assigned chain, including all ten 5-hop trials across all
three context conditions and both models. 39/40 produced the exact correct reversed token. The
single miss (fork condition, depth 2, trial 1) still opened both files in the 2-hop chain and read
the correct forward token — it produced an 11-character string where a 10-character reversal was
correct, i.e. a small transcription/processing slip on a correctly-retrieved value, not a hop left
unread.

No pattern emerged linking depth to failure: the one error occurred at depth 2, not the deepest
chain, and both depth 3 (9/9) and depth 5 (10/10) were perfect across all three context conditions.
No pattern emerged linking context load to failure either, beyond that one slip occurring under the
large/fork condition specifically (no other fork trial at any depth, and no small/padded trial at
any depth, showed any defect) — and the large/fork depth-5 trials (which carried the most inherited
context of any cell, ~202k tokens) were all correct.

See `evidence.md` for the full per-trial log and `conclusion.md` for the caveats that bound how far
this result should be generalized.
