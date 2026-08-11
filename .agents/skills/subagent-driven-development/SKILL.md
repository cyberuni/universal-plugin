---
name: subagent-driven-development
description: "Use this skill when committing changes in this repository, even if the user does not explicitly mention the required pre-commit checks."
metadata:
  internal: true
---

## Project Override: Pre-commit Check

Before any commit step, run:

```bash
nr check
```

Fix any formatting errors before committing. Do not commit with failing checks.

Also run `add-changeset` to add a changeset for the commit.
