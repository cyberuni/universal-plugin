---
title: How deep can a reference chain go?
description: Whether an agent actually follows a skill's 2nd, 3rd, or 5th hop into references/, and whether a full context window changes that — a pilot result, not a guarantee.
---

The [agentskills.io specification](https://agentskills.io/specification#file-references) says to
"keep file references one level deep from `SKILL.md`" and "avoid deeply nested reference chains."
That reads as a warning against a specific failure: an agent opens `SKILL.md`, follows a link into
`references/`, and either stops there or never gets to a second link it should have followed. This
page records a pilot that went looking for that failure directly, so the advice below is not just a
restatement of the spec — it says what actually happened when the chain was two, three, and five
hops deep.

## What "one level deep" actually means

It is about the number of hops in the *link graph* from `SKILL.md`, not about directory nesting.
`SKILL.md → references/governances/foo.md` is still one hop if `SKILL.md` links to `foo.md`
directly — the extra path segment doesn't cost anything. What the rule is against is
`SKILL.md → a.md → b.md → c.md`, where the agent has to follow a link, inside a file it just read,
to reach another file it needs before it can act.

This also means a **gateway skill** — one `SKILL.md` that branches to one of several
`references/<route>.md` files depending on what the caller wants — is not itself a violation.
Branching to *N* files instead of one doesn't add depth; the agent still opens exactly one reference
file to get what it needs. What *would* violate it is a route file that itself links out to another
file the agent has to open before it has enough to act — a real second hop. If a route needs that
much supporting material, promote it to its own top-level skill rather than nesting the reference
deeper.

## The pilot

Fixture chains were built at depth 1 (the instruction lives directly in the entry file), depth 2
(entry file → one `references/` file), depth 3 (entry file → `references/step1.md` →
`references/step2.md`), and depth 5 (entry file → four chained reference files, each explicitly
saying "the value is not in this file, go to the next one"). Each final hop carried a random,
unguessable token and a required action (reverse the token, reply with one exact line) — so success
requires both *reaching* the value and *correctly acting on it*, and those two things can be told
apart in the result.

40 trials ran across three context conditions — a fresh agent, an agent that had just read
~80–250k tokens of unrelated filler first, and a forked session carrying ~138–202k tokens of real
accumulated conversation — on Sonnet 5 (36 trials) and Opus 5 (a 4-trial spot check, one per depth).
Full method and per-trial data:
[`reference-chain-depth-reliability`](https://github.com/cyberuni/universal-plugin/blob/main/.research/reference-chain-depth-reliability/conclusion.md).

**Every trial opened every file in its chain**, including all ten 5-hop trials across all three
context conditions and both models. 39 of 40 produced the exact correct output. The one miss still
opened both files in a 2-hop chain and read the right value — it made a small copy error while
reversing it, which is a different problem (accuracy under load) than the one "avoid deep chains" is
written against (a hop going unread). That miss happened at depth 2, not the deepest chain tested;
both depth 3 and depth 5 were perfect across every condition, including the depth-5 fork trials,
which by then carried more inherited context (~202k tokens) than any other cell in the pilot.

## What this does and doesn't tell you

Don't restrict skill authoring to shallow chains purely out of fear that a deep hop gets silently
skipped — this pilot didn't find that happening, at any depth up to 5 or any of the three context
loads it tried. A gateway skill with route files one hop deep is fine, and even a genuinely deep
chain didn't fail to traverse here.

Still keep chains as shallow as they can honestly be, for a reason the pilot doesn't touch: a
shallow chain is easier for **you** to audit. Depth is a cost to the author who has to trace it, even
on evidence like this that it isn't reliably a cost to the agent reading it.

The result is a pilot (3 trials per Sonnet 5 cell, 1 per Opus 5 depth), not a settled rate, and it
tested hop-*traversal* — it told the agent directly that a skill had activated and handed it the
entry path, bypassing the description-matching step a runtime uses to decide whether to load the
skill at all. It also didn't test a true ~1M-token context (the forked condition carried real, but
far smaller, accumulated context) or chains past five hops. Read the caveats in the linked
conclusion before leaning on this for a chain shaped very differently from the one tested.

## Related

- [`reference-chain-depth-reliability`](https://github.com/cyberuni/universal-plugin/blob/main/.research/reference-chain-depth-reliability/conclusion.md) — full method, per-trial data, and caveats
- [agentskills.io specification: File references](https://agentskills.io/specification#file-references)
- The `marketplace` skill in this repo is a live example of the gateway pattern: one `SKILL.md`
  dispatching to `references/{init,add,validate}.md`, each one hop deep and self-contained
