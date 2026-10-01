# Codex Skill Invocation (October 2026)

## Question

`plugin build` wrote `~/.codex/prompts/<skill>.md` for every user-invocable skill (issue #133). Does
Codex still need a prompt to invoke a skill explicitly, and if so, can a plugin carry that prompt
inside its own tree?

## Scope

**In scope:** explicit and implicit skill invocation in Codex, custom prompts, plugin `commands`.

**Out of scope:** Codex hooks (see `hook-event-survey`) and manifest fields in general (see
`plugin-schema`).

## Sources checked

- Codex docs, "Build skills" — https://learn.chatgpt.com/docs/build-skills (developers.openai.com/codex/skills redirects there), read 2026-10-01.
- Codex docs, "Custom prompts" — https://learn.chatgpt.com/docs/custom-prompts (developers.openai.com/codex/custom-prompts redirects there), read 2026-10-01.
- `openai/codex` source at tag `rust-v0.159.3` (latest stable, 2026-09-30): `codex-rs/core-plugins/src/manifest.rs`, `codex-rs/core-plugins/src/command_migration/plugin.rs`, `codex-rs/core-plugins/src/store.rs`, `codex-rs/utils/plugins/src/lib.rs`, and a search of `codex-rs` for a prompts-directory reader.
- `openai/codex` release notes for `rust-v0.117.0` (2026-03-26).

## Findings

1. **Skills are invoked natively.** The skills docs say: "In Codex CLI or the IDE extension, run
   `/skills` or type `$` to mention a skill." Plugins distribute skills. No prompt is needed for
   explicit invocation.
2. **Custom prompts are deprecated and home-only.** The custom-prompts docs say: "Custom prompts are
   deprecated. Use skills for reusable instructions that Codex can invoke explicitly or implicitly."
   They "live in your local Codex home directory (for example, `~/.codex`), so they're not shared
   through your repository."
3. **The reader is gone.** In 0.159.3, no code under `codex-rs` reads a `prompts` directory under the
   Codex home. The `codex-prompts` crate holds Codex's own system prompts, and the TUI's
   "custom prompt" view is the free-text option of the review popup. Neither is the user-prompt
   feature.
4. **Plugin commands become skills.** The plugin manifest accepts a `commands` path (default
   `./commands`). On install, `store.rs` calls `migrate_plugin_commands`, which converts each command
   into a skill under `<plugin>/.codex-plugin/migrated-command-skills/`. The migration runs for the
   legacy manifest format, not for an agent-plugin (`plugin.json` at the root) manifest.

## Decision it informed

Issue #133: drop the Codex prompt step from `plugin build`. Installing prompts at install time
(option 2 in the issue) would write into a directory that current Codex no longer reads.
