# Evidence — Codex Skill Invocation

## E-CSI-01

- **Claim:** In Codex CLI and the IDE extension, a user invokes a skill explicitly with `/skills` or a `$` mention; plugins distribute skills.
- **Date:** 2026-10-01
- **Status:** confirmed
- **Confidence:** high
- **Source label:** Codex docs, Build skills
- **Source URL:** https://learn.chatgpt.com/docs/build-skills
- **Source type:** official docs
- **Notes:** developers.openai.com/codex/skills redirects (308) to this page.

## E-CSI-02

- **Claim:** "Custom prompts are deprecated. Use skills for reusable instructions that Codex can invoke explicitly or implicitly."
- **Date:** 2026-10-01
- **Status:** confirmed
- **Confidence:** high
- **Source label:** Codex docs, Custom prompts
- **Source URL:** https://learn.chatgpt.com/docs/custom-prompts
- **Source type:** official docs

## E-CSI-03

- **Claim:** Custom prompts load only from top-level Markdown files in `~/.codex/prompts/` and are not shared through a repository.
- **Date:** 2026-10-01
- **Status:** confirmed
- **Confidence:** high
- **Source label:** Codex docs, Custom prompts
- **Source URL:** https://learn.chatgpt.com/docs/custom-prompts
- **Source type:** official docs

## E-CSI-04

- **Claim:** Codex 0.117.0 added a startup deprecation warning for custom prompts (openai/codex#15076).
- **Date:** 2026-03-26
- **Status:** confirmed
- **Confidence:** high
- **Source label:** openai/codex release rust-v0.117.0
- **Source URL:** https://github.com/openai/codex/releases/tag/rust-v0.117.0
- **Source type:** release notes

## E-CSI-05

- **Claim:** Codex 0.159.3 has no code that reads a `prompts` directory under the Codex home.
- **Date:** 2026-10-01
- **Status:** confirmed
- **Confidence:** medium
- **Source label:** openai/codex source at rust-v0.159.3
- **Source URL:** https://github.com/openai/codex/tree/rust-v0.159.3/codex-rs
- **Source type:** source code
- **Notes:** Established by searching `codex-rs` for prompts-directory reads; absence of evidence, so medium confidence.

## E-CSI-06

- **Claim:** The Codex plugin manifest accepts a `commands` path; on install, Codex converts the commands into skills under `.codex-plugin/migrated-command-skills/` in the installed plugin (legacy manifest format only).
- **Date:** 2026-10-01
- **Status:** confirmed
- **Confidence:** high
- **Source label:** openai/codex core-plugins at rust-v0.159.3
- **Source URL:** https://github.com/openai/codex/blob/rust-v0.159.3/codex-rs/core-plugins/src/command_migration/plugin.rs
- **Source type:** source code
- **Notes:** Call site in `codex-rs/core-plugins/src/store.rs`; directory name in `codex-rs/utils/plugins/src/lib.rs`.
