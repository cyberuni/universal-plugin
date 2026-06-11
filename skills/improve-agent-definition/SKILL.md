---
name: improve-agent-definition
description: Use this skill when improving or writing an agent definition file for any major agent runtime.
---

# Improve Agent Definition

## When to use

Use when creating or reviewing a scoped agent or persona file for any major agent runtime:

| Runtime | File location | Format | Notes |
|---|---|---|---|
| Universal | `.agents/skills/<name>/SKILL.md` | YAML frontmatter + Markdown body | Portable across all runtimes |
| Claude Code | `.claude/agents/<name>.md` | YAML frontmatter + Markdown body | Vendor-specific sub-agent |
| Cursor | `.cursor/rules/<name>.mdc` | YAML frontmatter + Markdown body | `alwaysApply: false` = opt-in persona |
| Codex | `.codex/agents/<name>.md` | YAML frontmatter + Markdown body | Vendor-specific sub-agent |
| Copilot CLI | `.github/copilot-instructions.md` (persona section) | Markdown, no frontmatter | No scoped agent format |

All runtimes share the same underlying concern: give a scoped agent a clear role, trigger condition, and bounded instructions.

**Cursor note:** Cursor has no dedicated agent definition format. A rule with `alwaysApply: false` is the Cursor equivalent of a persona — it is loaded on demand rather than injected into every context.

## Prerequisites — confirm the file is an agent/persona definition

Before applying this skill, verify the target file is actually a scoped agent or persona definition, not a general config or always-on rule.

**Structural signals (file location / frontmatter):**

- Claude Code / Codex: file is under `.claude/agents/` or `.codex/agents/`
- Cursor: file has `alwaysApply: false` in frontmatter (always-on rules are not personas)
- Universal: file is a `SKILL.md` under `.agents/skills/<name>/`

**Content signal (strongest indicator):**

A persona definition establishes an identity — the body opens with or prominently states a role:

> "You are a senior frontend engineer…"
> "You are an experienced architect…"
> "You are a designer specializing in…"

If neither the frontmatter description nor the first paragraph establishes such a role, the file may be a task agent (instructions-only) rather than a persona. Both are valid — note which type you are reviewing, as personas require a role statement (see step 4).

If the file is an always-on rule or global config, this skill does not apply — stop and tell the user.

## Instructions

### 1. Identify the target runtime

Determine which runtime the file targets so you apply the correct format in steps 2–3.

### 2. Check required frontmatter fields (all runtimes except Copilot CLI)

Every agent file must have YAML frontmatter with at minimum:

```yaml
---
name: agent-identifier          # unique slug, kebab-case
description: Use this agent when <explicit trigger condition>. <One-line summary.>
---
```

**Description field rules (most important):**
- Start with "Use this agent when..." — this is how the runtime decides to delegate
- Be specific about trigger conditions (file types, task types, domains)
- Keep to one sentence — descriptions are truncated in the agent context window
- Do NOT include examples (e.g. `"Trigger when the user says 'review this'..."`) — examples belong in the skill body, not the description

**Runtime-specific required fields:**

| Field | Claude Code | Cursor | Codex |
|---|---|---|---|
| `name` | required | required | required |
| `description` | required | required | required |
| `alwaysApply` | not used | set `false` for persona (opt-in) | not used |

### 3. Check optional fields — add only what is needed

| Field | When to add |
|---|---|
| `model` | Agent needs a specific tier (`opus` for deep reasoning, `haiku` for speed) |
| `tools` | Restrict to least privilege — list only what the agent needs |
| `disallowedTools` | Easier to block a few tools than list all allowed |
| `globs` | Cursor only — scope activation to specific file patterns |

Do NOT add optional fields speculatively. Omit means inherit default.

### 4. Review the system prompt body

Apply these rules to the Markdown body (or full file for Copilot CLI):

**Recommended sections (in order, omit any that don't apply):**

1. **Role** — one sentence: who the agent is and its domain
2. **Responsibilities** — bullet list of what it does (not how)
3. **Output format** — exactly what artifacts it produces and in what shape
4. **Human-in-the-loop rules** — explicit conditions to pause and ask before continuing
5. **Out of scope** — what this agent must NOT do (prevents scope creep)

**Quality checklist:**
- [ ] If persona: body opens with "You are a [seniority] [role]…" establishing identity
- [ ] Role is stated in one sentence
- [ ] Each responsibility covers one bounded concern
- [ ] Output format is concrete: file path, JSON shape, PR description format, etc.
- [ ] Human-in-the-loop rules cover irreversible actions (push, deploy, delete, PR creation)
- [ ] No overlapping duties with other agents in the project
- [ ] Instructions are specific ("use TypeScript strict mode", not "write clean code")
- [ ] Prompt body is under 200 lines
- [ ] No self-evident filler ("be helpful", "write good code")

### 5. Common mistakes — fix these

| Mistake | Fix |
|---|---|
| Description says what agent does, not when to use it | Rewrite to start with "Use this agent when..." |
| Description contains examples ("Trigger when the user says...") | Move examples to the skill body; description is for trigger conditions only |
| Persona body does not open with a role statement | Add "You are a [seniority] [role]…" as the first line of the body |
| Agent is too broad ("handles all backend tasks") | Split into scoped agents per domain |
| No output format specified | Add explicit Output section |
| No human-in-the-loop rules | Add rules for any irreversible action |
| `tools:` omitted when agent only needs read access | Add `tools: [Read, Grep, Glob]` (Claude Code / Codex) |
| Cursor persona has `alwaysApply: true` | Set `alwaysApply: false` — personas are opt-in |
| Prompt body over 200 lines | Extract reference docs to separate files; link from References |

### 6. Example — well-formed agent definition (Claude Code / Cursor / Codex)

```markdown
---
name: code-reviewer
description: Use this agent when reviewing a pull request or changed files for correctness, security, and style.
tools: [Read, Grep, Glob, Bash]
---

# Code Reviewer

## Role
You are a senior code reviewer focused on correctness, security, and maintainability.

## Responsibilities
- Read changed files and identify bugs, logic errors, and security issues
- Flag violations of project conventions from CLAUDE.md / AGENTS.md
- Suggest concrete fixes, not just observations

## Output format
Return a Markdown list grouped by severity: CRITICAL, WARNING, SUGGESTION.
Each item: `[SEVERITY] file:line — description. Suggested fix: ...`

## Human-in-the-loop rules
- Do not post comments to GitHub without explicit user confirmation
- If you find a CRITICAL security issue, stop and report before continuing

## Out of scope
- Do not modify files — report only
- Do not review test files unless explicitly asked
```

## References

- [Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents)
- [Cursor rules docs](https://docs.cursor.com/context/rules)
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
