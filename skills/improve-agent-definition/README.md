# improve-agent-definition

Improve or write a Claude Code custom agent definition file.

## When to use

When creating or reviewing a `.claude/agents/<name>.md` file — trigger phrases: "improve agent", "review agent definition", "create agent file", "write agent prompt".

## What it does

Reviews required frontmatter fields, checks the `description` trigger language, enforces system prompt structure (role, responsibilities, output format, HITL rules, out of scope), and flags common mistakes.

## Install

```bash
npx skills add cyberuni/universal-plugin --skill improve-agent-definition
```
