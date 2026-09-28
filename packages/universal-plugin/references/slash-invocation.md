# Slash Invocation

Use a skill's `invocation-policy` frontmatter field to say who may invoke it.
`skills/` remains the only canonical prompt-artifact tree; do not create a
parallel canonical `commands/` tree.

```md
---
description: Deploy the application after running release checks.
invocation-policy: user
---

Deploy $ARGUMENTS.
```

| Policy | Meaning | Default |
| --- | --- | --- |
| `user` | A person invokes the skill explicitly. Use for side-effecting workflows such as deploy or release. | No |
| `model` | The model may invoke the skill, but it is hidden from the slash menu. Use for background knowledge. | No |
| `both` | Either a person or the model may invoke the skill. | Yes |

`plugin build` derives vendor behavior from that policy:

- Claude Code uses the same `SKILL.md` and adds its native invocation flag.
- Cursor receives a thin `.cursor/commands/<skill>.md` prompt insert for `user` and `both` skills.
- Codex receives a best-effort, local-only `~/.codex/prompts/<skill>.md` for `user` and `both` skills. Codex has deprecated custom prompts, so the skill remains the primary integration.
- Copilot CLI receives no derived command. Its `/skill-name` form is only a prompt hint, not deterministic invocation.

If a workflow requires deterministic user-triggered invocation, document Copilot
CLI as unsupported for that workflow.
