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

## Codex — works, and reads two paths

Catalog: `.agents/plugins/marketplace.json`, which `marketplace init --codex` writes. Codex also
reads `.claude-plugin/marketplace.json`, so a repository that generates only the Claude catalog is
installable from Codex too (E-CODEX-M10, E-CODEX-M11).

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

**Discovery is by filename.** Codex looks for `marketplace.json` inside a supported directory. These
are read: `.claude-plugin/`, `.agents/plugins/`. These are not, with the correct filename in each:
`.codex-plugin/`, `.plugin/`, `.github/plugin/`, the repository root (E-CODEX-M10).

The two catalogs are not interchangeable in content. The Codex one carries `interface`, `policy`,
`category`, and an object `source`; Codex accepts the Claude shape as well, but Claude Code rejects
the Codex shape for its missing `owner` (E-CC-M5, E-CODEX-M9). Where a repository wants one file
instead of two, that file is the Claude one.

Codex copies an install to `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>`, keyed by the
version the **plugin's own manifest** carries rather than the catalog entry's (E-CODEX-M13,
E-CODEX-M15). A source edit is invisible until the plugin is installed again and a new session
starts; `codex plugin add` on its own is the reinstall, because re-running it at the same version
overwrites the cached copy (E-CODEX-M14). A catalog entry that declares no version installs normally
(E-CODEX-M16).

## Cursor — a catalog it reads, but no command to install from one

Cursor reads a repository-local catalog: `.cursor-plugin/marketplace.json` or
`.claude-plugin/marketplace.json` (E-CUR-M5), so the Claude catalog covers it. The documented shape
is close to Claude Code's — `name`, an object `owner` carrying `name` and an optional `email`, and
`plugins` whose `source` is a path inside the repository (E-CUR-M6). `marketplace init --cursor`
writes it.

Nothing on the command line consumes one. `cursor-agent` has no plugin subcommand (E-CUR-M2), and
users install from the Customize sidebar, sourced from Cursor's reviewed marketplace,
cursor.directory, or a team marketplace (E-CUR-M1). A repository catalog reaches users when an admin
imports it: Dashboard → Plugins → Team Marketplaces → Add Marketplace → Import from Repo, after
which Auto Refresh tracks the branch the marketplace is configured against (E-CUR-M7). So generate
the file and write no Cursor install command.

For local development, `universal-plugin plugin install` copies the plugin into
`~/.cursor/plugins/local/<name>`; reload the window afterwards. It copies rather than symlinks
because Cursor's scan resolves each symlink and rejects a target outside that directory (E-CUR-M4),
which is what the `ln -sfn "$(pwd)"` recipe that used to sit here ran into.

## When these decay

A vendor command is a claim with a shelf life. Re-verify against the vendor page before relying on
an entry that looks stale, and update the evidence file in the same change. The recheck triggers are
listed in `.research/local-marketplaces/conclusion.md`.
