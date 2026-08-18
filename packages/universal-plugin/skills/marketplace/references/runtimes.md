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

## Codex — no documented CLI marketplace verb

Codex CLI installs from a browser inside the session:

```
/plugins
```

The user adds a configured marketplace there, installs, then starts a new session (E-CODEX-M1). The
build-plugins page describes `@plugin-creator` (`$plugin-creator` inside Codex) for adding a folder
to a local marketplace, and documents no marketplace manifest format (E-CODEX-M2).

**Do not publish `codex plugin marketplace add` or `codex plugin add`.** Those appear in a
third-party README and in no vendor page reviewed here (E-CODEX-M3). If a user asks for them, say
they are uncorroborated and let them decide.

`marketplace init --codex` writes `.agents/plugins/<name>.json`. No documentation reviewed here
describes that path or its `interface`/`policy`/`category` schema (E-CODEX-M4). Generate it if the
user wants it. Do not claim Codex reads it.

## Cursor — no repository-local marketplace

Users install from the Customize sidebar, sourced from Cursor's reviewed marketplace,
cursor.directory, or a team marketplace (E-CUR-M1). There is no catalog a repository can carry.

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
