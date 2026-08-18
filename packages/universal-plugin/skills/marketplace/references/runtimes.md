# Install commands per runtime

The only source of install commands for this skill. Every entry traces to vendor documentation
reviewed on 2026-08-18 and recorded in `.research/local-marketplaces/evidence.md`. A command not
listed here does not go into a README.

## Claude Code — documented, complete

Catalog: `.claude-plugin/marketplace.json` at the repository root (E-CC-M1).

```
/plugin marketplace add <owner>/<repo>
/plugin install <plugin>@<marketplace-name>
```

`<marketplace-name>` is the `name` field inside `marketplace.json`, not the repository name (E-CC-M2).

Both verbs also exist outside the session as `claude plugin marketplace add` and
`claude plugin install`. In a non-interactive shell, `--yes` accepts the command string an install
prints (E-CC-M3). Users refresh a catalog with `/plugin marketplace update`.

Plugin `source` paths resolve against the marketplace root, the directory holding `.claude-plugin/`.
They do not resolve when a user adds the marketplace by direct URL to the JSON file, so a repository
distributing by URL must use a non-relative plugin source (E-CC-M4).

Auto-update is off by default for third-party marketplaces, so a user who wants background refresh
enables it once from `/plugin` → Marketplaces. That is a user-side setting; this skill does not
change it.

## GitHub Copilot CLI — documented, complete

Catalog: `.github/plugin/marketplace.json`. Copilot CLI also accepts `marketplace.json` at the root,
in `.plugin/`, or in `.claude-plugin/` (E-COPILOT-M3).

```
copilot plugin marketplace add <owner>/<repo>
copilot plugin install <plugin>@<marketplace-name>
```

The marketplace's own `name` becomes its registration key, and a user cannot choose a local alias
(E-COPILOT-M1). `copilot plugin install` also accepts `OWNER/REPO`, `OWNER/REPO:PATH`, a Git URL, or
a local path, so a plugin is installable from a repository even without a catalog (E-COPILOT-M2).

## Codex — works, and reads the Claude catalog

Catalog: `.claude-plugin/marketplace.json`. Codex reads that path and no other tested one
(E-CODEX-M4). A repository that already generated the Claude catalog is already installable from
Codex.

```
codex plugin marketplace add <owner>/<repo>
codex plugin add <plugin>@<marketplace-name>
```

`marketplace add` also accepts a local path, `owner/repo@ref`, an HTTPS Git URL, or an SSH Git URL,
with `list`, `upgrade`, and `remove` beside it (E-CODEX-M3).

**Codex installs with `plugin add`, not `plugin install`.** Copilot CLI is the opposite. Do not
carry one runtime's verb over to the other.

Neither verb appears in Codex's published documentation. Both are in the shipped CLI, verified on
codex-cli 0.147.0.

The catalog must carry `owner` even though Codex does not require it, because the same file has to
satisfy Claude Code, which rejects a catalog without one (E-CC-M5). Use string sources
(`"source": "./plugins/demo"`); Codex also accepts an object form, Claude Code's schema is the
stricter of the two, and one file has to pass both.

**`marketplace init --codex` writes `.agents/plugins/<name>.json`, which Codex does not read**
(E-CODEX-M5). The location is the problem, not the content: that same JSON is accepted when it sits
at `.claude-plugin/marketplace.json` (E-CODEX-M9). A fixture carrying only that file is rejected with "marketplace root does not contain a
supported manifest". To make a repository installable from Codex today, generate the Claude catalog:

```bash
node scripts/marketplace.mjs --claude
```

Say plainly that the one file serves both runtimes. Do not generate `--codex` and tell the user Codex
will read it.

## Cursor — no repository-local marketplace

Users install from the Customize sidebar, sourced from Cursor's reviewed marketplace,
cursor.directory, or a team marketplace (E-CUR-M1). There is no catalog a repository can carry, and
`cursor-agent` has no plugin subcommand (E-CUR-M2).

Local development uses a symlink:

```sh
ln -sfn "$(pwd)" ~/.cursor/plugins/local/<plugin-name>
```

Then reload the window. `marketplace init --cursor` writes `.cursor-plugin/marketplace-submission.json`
and a `CURSOR_MARKETPLACE_SUBMISSION.md` handoff. Both are inputs to a human submission.

## When these decay

A vendor command is a claim with a shelf life. Re-verify against the vendor page before relying on
an entry that looks stale, and update the evidence file in the same change. The recheck triggers are
listed in `.research/local-marketplaces/conclusion.md`.
