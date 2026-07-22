# 0004 — Slash invocation: skills are canonical, commands are an invocation policy

**Status:** accepted
**Date:** 2026-07-21

## Context

Issue [#3](https://github.com/cyberuni/universal-plugin/issues/3) carried one still-open research
item after the rest of its proposal was either shipped or ruled out of charter (ADR-0001): *clarify
the correct distinction between `commands/` and `skills/` for slash invocation across vendors, and
capture it as an ADR or a shipped governance.*

The canonical `.plugin/plugin.json` today declares `"skills": "./skills/"` and has **no `commands`
concept**; `plugin build` derives per-vendor manifests from skills only. So the open question is
concrete: should `commands/` become a first-class canonical concept alongside `skills/`, or should
skills stay the single concept with slash commands derived per vendor?

Two prompt-artifact kinds are in play:

- **skill** — a model-invoked capability the agent auto-loads by description (`skills/<name>/SKILL.md`,
  [agentskills.io](https://agentskills.io) format).
- **command** — a user-typed slash command (`/review`) the human explicitly invokes.

### What each Tier-1 runtime actually does (2026-07)

- **Claude Code** — commands and skills are **one mechanism**. A file at `.claude/commands/deploy.md`
  and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy`. Whether a skill is user-typed,
  model-invoked, or both is a **frontmatter flag** (`disable-model-invocation: true` → user-only;
  `user-invocable: false` → model-only), not a directory.
  ([docs](https://code.claude.com/docs/en/slash-commands))
- **Cursor** — separate **commands** (`.cursor/commands/*.md`, user-typed prompt insert), **rules**
  (`.cursor/rules/*.mdc`, passive context), and **skills** (`.cursor/skills/.../SKILL.md`), but
  Cursor ships a `/migrate-to-skills` converter folding commands into skills. A command is a thin
  prompt-insert: filename → `/name`, body = prompt, no supporting-file dir.
- **Codex (OpenAI)** — **custom prompts** (`~/.codex/prompts/*.md`, user-invoked slash commands,
  **local-only, not shared via repo**) are officially **deprecated** in favor of skills, which add
  implicit (model) invocation and repo-shareability.
  ([docs](https://learn.chatgpt.com/docs/custom-prompts))
- **GitHub Copilot CLI** — **no user-defined file-based slash commands** exist (open, unsupported
  feature request). It supports skills (`SKILL.md`, read from `.github/skills`, `.claude/skills`,
  `.agents/skills`, …) and custom agents (`.github/agents/*.agent.md`). A user *can* prefix
  `/skill-name`, but that is a prompt hint, not a guaranteed deterministic invoke.
  ([skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills))

The industry vector is unambiguous: three of four runtimes are deprecating or absorbing their
separate command mechanism into skills; the fourth never shipped file-based user commands at all.

## Decision

1. **`skills/` stays the single canonical prompt-artifact concept.** It is the true cross-vendor
   universal minimum. The canonical `.plugin/plugin.json` does **not** gain a first-class `commands/`
   sibling.

2. **"Command" is modeled as an invocation policy on a skill, not a separate artifact.** A skill may
   optionally declare who invokes it — user-only, model-only, or both (default). This is skill
   metadata (mirroring Claude Code's `disable-model-invocation` / `user-invocable`), carried in the
   canonical manifest, not a second directory tree. A user-typed slash command is a strict *subset*
   of a skill (filename→`/name`, body=prompt); nothing is lost by not making it first-class.

3. **Per-vendor slash commands are a `plugin build` compile target, derived — not authored.** When a
   skill is marked user-invocable, build's per-vendor derivation targets:
   - **Claude Code** → the skill plus the invocation frontmatter flag (same artifact).
   - **Cursor** → emit `.cursor/commands/*.md` (thin prompt-insert) in addition to the skill.
   - **Codex** → emit `~/.codex/prompts/*.md` — with the caveat that Codex prompts are local-only and
     deprecated; prefer the skill and treat the prompt as best-effort.
   - **Copilot CLI** → skill only; there is no user-command surface to derive.

4. **Deterministic user-triggered invocation is a three-vendor guarantee.** Claude Code, Cursor, and
   Codex support a deterministic user-typed command; Copilot CLI's `/skill-name` is a hint, not a
   guarantee. Any plugin behavior that *requires* deterministic user invocation must document Copilot
   CLI as unsupported for that path.

## Consequences

- **Low-regret.** Betting canonical on `skills/` aligns with where every vendor is heading and avoids
  a `commands/` concept that would immediately strand Copilot CLI.
- **No behavior change ships in this CR.** This ADR is a design record (no `.feature`, no gate), like
  ADR-0001..0003. The invocation-policy field and build's per-vendor command derivation are **deferred
  behavioral work** — a future `revise` CR on `plugin/build/` (placement pre-decided here). Filed as a
  follow-up on #3.
- **Authoring guidance is deferred with the feature.** A shipped `slash-invocation.md` governance for
  plugin authors (how to mark a skill user-only) lands with the build-derivation CR, not before —
  guidance for a field that does not yet exist would be premature.

## Alternatives considered

- **First-class canonical `commands/` tree** — rejected. It strands Copilot CLI (no target), duplicates
  a concept that is a strict subset of a skill, and fights the industry-wide collapse-into-skills
  direction. Every command expressible as a canonical artifact is expressible as a user-only skill.
- **A shipped governance instead of an ADR** — deferred, not rejected. The decision belongs in an ADR;
  author-facing governance belongs with the feature that gives authors something to configure.
