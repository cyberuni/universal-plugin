# Changes

## 2026-08-18 — created, corrected against the CLIs, then corrected again

Opened while adding a `marketplace` skill, prompted by a third-party README that publishes install
commands for four runtimes.

**First pass, documentation only.** Concluded that Codex's marketplace commands were uncorroborated
and that this project's Codex catalog path was unsourced.

**Second pass, running the CLIs.** Both conclusions were wrong. `codex plugin marketplace add` and
`codex plugin add` exist in codex-cli 0.147.0; the docs do not cover them. Fixture probes then
suggested Codex reads only `.claude-plugin/marketplace.json`, so `marketplace init --codex` looked
like a defect and was filed as issue #42.

**Third pass, correcting the probe.** The `.agents/plugins` fixture had been named `<name>.json`
while the command writes `marketplace.json`. Codex discovers a catalog by that filename, so the probe
had tested the name and not the directory. With the filename held constant, `.agents/plugins/` is
accepted and installs end to end. E-CODEX-M4 and E-CODEX-M5 are retracted, E-CODEX-M10 and
E-CODEX-M11 replace them, and #42 was closed as invalid.

## 2026-08-18 — extended to local development installs, and Cursor's catalog corrected

Opened again for `plugin install` (issue #33), which needed the one thing this topic had only in
passing: where an author's working copy goes so a runtime loads it.

Two published recipes turned out to be wrong. `~/.claude/plugins/local/` does not exist in Claude
Code — the string appears nowhere in the shipped executable — and the path that does work is the
skills directory, `~/.claude/skills/<dir>`, which adopts a plugin and loads it as `<name>@skills-dir`
(E-CC-M6, E-CC-M7). Cursor's `~/.cursor/plugins/local/` is real, but its scan resolves each symlink
and rejects any target outside the directory, so the symlink half of the recipe installs nothing
there either (E-CUR-M3, E-CUR-M4). Both were verified against shipped builds rather than docs; the
Claude finding was run end to end, the Cursor findings were read out of the bundle.

The topic's standing verdict that **Cursor has no local marketplace** is retracted. The shipped CLI
carries `.cursor-plugin/marketplace.json` and `.claude-plugin/marketplace.json` as the manifests it
looks for (E-CUR-M5), so the Claude catalog already covers Cursor.


## 2026-08-18 — fifth pass: the Cursor catalog against the vendor page, and Claude Code's owner shape

Re-verified while implementing issue #45, which generates the Cursor catalog and so leans on the
weakest row here. Two additions and one narrowing; nothing was overturned.

The fourth pass established Cursor's catalog from the shipped bundle alone. Cursor's plugins
reference documents the same file and its fields, so the row now rests on two independent sources
(E-CUR-M6), and it names the path a repository catalog actually travels to users: an admin imports
the repository as a team marketplace (E-CUR-M7). E-CUR-M1 is narrowed rather than retracted, since
only its last sentence — no documented format — was wrong, and it was wrong because the format sits
on the reference page rather than the install page it was read from.

`claude plugin validate` rejects a string `owner` outright (E-CC-M8), which every catalog this
project generated had been carrying. It also accepts an entry whose source directory holds only a
canonical root `plugin.json` (E-CC-M9), which is what lets `plugin init` register a plugin that has
no vendor manifest yet.
