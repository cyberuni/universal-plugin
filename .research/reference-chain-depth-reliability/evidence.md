# Evidence Log

This topic's "evidence" is a first-party experiment run in-session, not a vendor claim, so each
entry below is a trial result rather than a cited quote. "Source" is the fixture path and the
subagent's own report; "confidence" reflects sample size (n=1 or n=3 per cell), not source
reliability.

## E1 — Fresh context, Sonnet 5, all three depths: 9/9 correct

**Claim:** With no prior context, Sonnet 5 opened every file in 1-, 2-, and 3-hop chains and
produced the exact required output in all 9 trials (3 trials × 3 depths).
**Confidence:** MEDIUM (n=3/cell)
**Source:** fixtures at `known/depth{1,2,3}/`; results — depth1: `TWXR9K4QLP` ×3; depth2:
`NBDQ8W2MZH` ×3 (opened `procedure.md` + `references/step.md`); depth3: `YGLN3T6VJF` ×3 (opened
`procedure.md` + `references/step1.md` + `references/step2.md`). All match the expected reversal of
the known tokens (`PLQ4K9RXWT`, `HZM2W8QDBN`, `FJV6T3NLGY` respectively).

---

## E2 — Small/padded context (~80–250k tokens after reading filler), Sonnet 5: 9/9 correct

**Claim:** After being made to read an ~110k-token filler document in full before the real task,
Sonnet 5 still opened every file in the chain at all three depths and produced the exact required
output in all 9 trials.
**Confidence:** MEDIUM (n=3/cell)
**Source:** same `known/` fixtures; reported `subagent_tokens` ranged 71k–248k depending on how the
agent chunked its filler reads (some read the 577KB filler in fewer, larger Read calls; others in
many small ones — tool-use counts ranged 6–16). Results: depth1: `TWXR9K4QLP` ×3; depth2:
`NBDQ8W2MZH` ×3; depth3: `YGLN3T6VJF` ×3 — identical to the fresh-condition results.

---

## E3 — Large context via fork (~138–139k tokens inherited), Sonnet 5: 8/9 correct, 1 transcription slip

**Claim:** Forking the orchestrating session (inheriting ~138–139k tokens of real accumulated
conversation) produced correct hop-traversal in all 9 trials, but one trial's final transform was
wrong despite reading the correct value.
**Confidence:** MEDIUM (n=3/cell)
**Source:** blind fixtures at `blind/depth{1,2,3}/`; true tokens (revealed only after all fork calls
were dispatched) were `RPP2JJ866G` (depth1), `WZWRV42AXW` (depth2), `U0YKVMF8M3` (depth3);
expected reversals `G668JJ2PPR`, `WXA24VRWZW`, `3M8FMVKY0U`.
- depth1: `G668JJ2PPR` ×3 — correct.
- depth2: trial1 `WXAX24VRWZW` (11 chars, extra `X` inserted — **incorrect**, expected 10-char
  `WXA24VRWZW`); trial2 `WXA24VRWZW` — correct; trial3 `WXA24VRWZW` — correct. All three trials
  opened both `procedure.md` and `references/step.md`, i.e. all reached and read the correct
  forward token (`WZWRV42AXW`); only the reversal itself was wrong in trial1.
- depth3: `3M8FMVKY0U` ×3 — correct, all three trials opened all three files in the chain.

---

## E4 — Fresh context, Opus 5 spot check, all three depths: 3/3 correct

**Claim:** Opus 5, tested only at the fresh condition (n=1 per depth, not a full matrix, per scope
agreed for this pilot), also opened every file in the chain and produced the exact required output
at all three depths.
**Confidence:** LOW (n=1/cell — spot check only, not intended to support a rate claim)
**Source:** `known/` fixtures; results depth1 `TWXR9K4QLP`, depth2 `NBDQ8W2MZH`, depth3
`YGLN3T6VJF` — all correct, matching the Sonnet 5 fresh-condition results exactly.

---

## E5 — No Opus 5 data at large/padded context

**Claim:** This pilot has no Opus 5 result for the small or large context conditions.
**Confidence:** N/A (documented gap, not a finding)
**Source:** the `fork` subagent type always inherits the orchestrating session's own model
(Sonnet 5 in this run) regardless of a requested model override, so a genuine Opus-under-large-
context trial could not be produced via fork; building an equivalent large context for Opus from a
fresh agent was out of scope (it would reintroduce the cost the fork was chosen to avoid).

---

## E6 — Depth 5 (four reference hops past the entry file): 10/10 correct across all conditions and both models

**Claim:** A follow-up request extended the same method to a 5-hop chain (`procedure.md` →
`step1.md` → `step2.md` → `step3.md` → `step4.md`, token in the last file) to check whether a
failure mode would appear further out than depth 3. It did not: all 10 trials (3 fresh + 3
small/padded + 3 large/fork, Sonnet 5; 1 fresh, Opus 5) opened every file in the chain and produced
the exact correct output.
**Confidence:** LOW–MEDIUM (n=3/cell for Sonnet 5, n=1 for the Opus 5 spot check — same caveats as
E1–E4)
**Source:**
- Known token (fresh/small): `QNP5XW8CTM` → expected `MTC8WX5PNQ`. Fresh Sonnet 5 ×3: `MTC8WX5PNQ`,
  each opening all 5 files (`procedure.md` + `references/step1.md..step4.md`). Small/padded
  Sonnet 5 ×3: `MTC8WX5PNQ`, `subagent_tokens` 114k–248k (again reflecting how the agent chunked its
  filler reads). Fresh Opus 5 ×1: `MTC8WX5PNQ`.
- Blind token (large/fork): `3RFE7TRXPR` → expected `RPXRT7EFR3`, revealed only after all fork calls
  were dispatched. Large/fork Sonnet 5 ×3: `RPXRT7EFR3`, each opening all 5 files;
  `subagent_tokens` ~202k — the largest inherited-context figure of any cell in this topic, since
  by the time these ran, more had accumulated in the orchestrating session than when the depth 1–3
  fork trials ran (~138–139k tokens). No degradation despite the larger inherited context.
