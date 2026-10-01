# Codex Skill Invocation — Conclusion (October 2026)

**Question:** How does Codex reach a plugin's skills, and can a plugin ship Codex custom prompts
(`~/.codex/prompts/*.md`) or commands?

**Answer:** Codex reaches plugin skills natively. A user invokes one explicitly with `$name` or
`/skills`, and the model can invoke it implicitly (E-CSI-01). Custom prompts are deprecated (E-CSI-02),
load only from the user's Codex home directory, so a plugin cannot ship them (E-CSI-03), and the
Codex 0.159.3 source has no reader for `~/.codex/prompts` at all (E-CSI-05).

A plugin can ship a `commands` path. Codex does not keep commands as commands: at install time it
converts them into skills under `.codex-plugin/migrated-command-skills/` inside the installed plugin
(E-CSI-06).

**Consequence for universal-plugin:** `plugin build` derives no Codex prompt. A skill is the whole
Codex integration, and a build writes nothing outside the plugin tree (issue #133).

## Open questions

- Which Codex release removed the custom-prompt reader. 0.117.0 added a startup deprecation warning
  (E-CSI-04); the removal commit was not traced.
