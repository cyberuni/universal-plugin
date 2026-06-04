# Plugin Domain Spec

**Status:** Planned
**Commands:** `uni-plugin add`, `uni-plugin remove`, `uni-plugin update`, `uni-plugin find`, `uni-plugin search`, `uni-plugin list`, `uni-plugin migrate`
**Governance:** [cli-command](../../governances/cli-command.md)

---

## What

The plugin domain manages installed plugins — adding, removing, updating, discovering, and migrating them. It is the consumption-side counterpart to the authoring commands (`build`, `validate`, `init`). It mirrors the structure of `cyber-skills`' registry domain, operating on plugins rather than skills.

---

## Why

Plugin consumers need a consistent way to install and manage plugins across runtimes without learning each vendor's specific mechanism. A single CLI surface handles resolution, scope management, and lock-file tracking regardless of whether the plugin comes from npm or a GitHub repo.

---

## Design decisions

### Lock file tracks installed plugins

Installed plugins are recorded in a lock file (`.agents/uni-plugin-lock.json` for project scope, `~/.agents/uni-plugin-lock.json` for global scope). The lock file captures the source, source type, and resolved version of each installed plugin.

### Scope: project vs global

All commands support `--global` (user scope, `~/.agents/`) and `--project` (project scope, default). When neither is passed in non-interactive mode, project scope is used. In interactive mode, the user is prompted to choose.

### `find` vs `search`

| Command | What it does |
|---|---|
| `find [query]` | Searches locally — installed plugins and configured registries |
| `search <query>` | Searches remotely — the marketplace API or a specified registry |

### Interactive flows

`add` and `remove` support interactive selection when running in a TTY without `--yes` and without an explicit target:

- `add <repo>` with no skill specified: prompts to select from available plugins in the repo
- `remove` with no name: prompts to select from installed plugins

### Plugin spec format

Plugin specs follow the same convention as `cyber-skills`:

- `org/repo` — GitHub repo (installs all plugins)
- `org/repo:plugin-name` — specific plugin from a GitHub repo
- `@scope/package` or `package` — npm package

### Migration

`migrate` converts an existing lock file format (from an older version or a different tool) into the current format. Supports `--dry-run`.

---

## Command surface

### `uni-plugin add <spec>`

```
uni-plugin add <spec> [--global] [--project] [--branch <branch>]
                      [--yes] [--root <path>] [--format <format>]
```

Installs a plugin from a GitHub repo or npm package. In interactive mode with a bare repo spec, prompts for plugin and scope selection.

**Exit codes:** `0` = installed; `1` = not found, network error, or all selected plugins skipped

---

### `uni-plugin remove [name]`

```
uni-plugin remove [name] [--global] [--project] [--root <path>] [--format <format>]
```

Removes an installed plugin. In interactive mode without `name`, prompts to select from installed plugins.

**Exit codes:** `0` = removed; `1` = not found or removal error

---

### `uni-plugin update [name]`

```
uni-plugin update [name] [--global] [--project] [--branch <branch>]
                         [--root <path>] [--format <format>]
```

Updates one plugin (by name) or all installed plugins (if name omitted). In interactive mode without `name`, prompts to select scope.

**Exit codes:** `0` = updated (or already up to date); `1` = not found or update error

---

### `uni-plugin find [query]`

```
uni-plugin find [query] [--in <repo>] [--limit <n>] [--offset <n>]
                        [--root <path>] [--format <format>]
```

Searches locally-known plugins (installed + configured registries). `--in <repo>` narrows to a specific repo.

**Exit codes:** `0` always (empty result is not an error)

---

### `uni-plugin search <query>`

```
uni-plugin search <query> [--registry <url>] [--limit <n>] [--offset <n>]
                           [--format <format>]
```

Searches the remote marketplace or a specified registry. Cursor-based pagination is planned (see [issue #5](https://github.com/cyberuni/cyber-universal-agent-plugin/issues/5)).

**Exit codes:** `0` always (empty result is not an error)

---

### `uni-plugin list`

```
uni-plugin list [--global] [--root <path>] [--format <format>]
```

Lists installed plugins from the lock file.

**Exit codes:** `0` always

---

### `uni-plugin migrate`

```
uni-plugin migrate [--global] [--dry-run] [--root <path>] [--format <format>]
```

Migrates an older lock file format to the current schema.

**Exit codes:** `0` = migrated; `1` = source not found or parse error

---

**Gherkin scenarios:** `plugin.feature` (planned)
