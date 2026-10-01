---
'universal-plugin': patch
---

`plugin build` no longer writes Codex custom prompts to `~/.codex/prompts/`. Codex invokes plugin skills natively with `$name` or `/skills`, and its custom prompts are deprecated and no longer read, so the build now writes nothing outside the plugin tree. You can delete prompts that an earlier build left in `~/.codex/prompts/`.
