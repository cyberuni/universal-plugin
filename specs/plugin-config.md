# Plugin Config Subcommand

**Status:** Draft

---

## What

A `config` subcommand for the `universal-plugin` CLI that lets plugins read and write keyed configuration entries into `.agents/universal-plugin.json`. Plugins write entries at install time; consumers read them lazily at delegation time.

Commands:

```bash
npx universal-plugin config add --key <key> --entry '<json>'
npx universal-plugin config get --key <key>
```

---

## Why

Plugins need a standard way to register metadata that other plugins consume at runtime — without coupling the consumer to specific plugin names or requiring that knowledge to be loaded every session.

The concrete motivating case: the SDD plugin needs to discover which plugins handle spec work for specific domains (e.g. ACES handles agent evaluation specs). This mapping is not static — it depends on which plugins are installed in the repo. A shared config file written at install time and read lazily solves this without session overhead.

---

## Design decisions

**Storage: `.agents/universal-plugin.json`**
Already used by `universal-plugin` for its own config (`packagePath`, `vendors`). Extending it with plugin-registered keys keeps all plugin tooling config co-located. The file is not a build artifact — it is committed and intentional.

**Array-merge semantics for `add`**
Each key holds an array. `config add` appends if no entry with the same `name` exists; replaces if one does. This makes `add` idempotent for re-installs.

**Free-form entry JSON (no schema enforcement at CLI level)**
The CLI does not validate entry shape beyond valid JSON. Each key's schema is owned by the consumer (e.g. SDD defines what a `sdd-plugins` entry must contain). This keeps the CLI generic.

**`config get` returns the full array for a key**
Outputs JSON to stdout. Consumers parse it themselves.

---

## Command surface

```bash
# Add (or replace by name) an entry under a key
npx universal-plugin config add --key <key> --entry '<json>'

# Read all entries under a key
npx universal-plugin config get --key <key>
```

Config file location: `.agents/universal-plugin.json` in the repo root (resolved from cwd).

---

## Resolved

- **Version locking** — resolved. Callers pin the runner to an explicit version with `npx universal-plugin@<version>` (or the local-first `upx universal-plugin@^<major>`), kept current by the `upgrade-universal-plugin` skill. The same mechanism ships in `plugin bundle --runner` and the prepare-hook pinning convention. This unblocks calling `config add` from plugin install scripts (see `apps/web/src/content/docs/cli/config.md`). Adoption inside each consumer plugin's own install flow is tracked per-plugin (issue #18).

## Open questions

- **Remove command** — not in scope for v1; can be added when a plugin uninstall flow exists.

---

## Related

- `.agents/universal-plugin.json` schema — currently unversioned; may need a `version` field once multiple consumers write to it
- SDD plugin — first consumer of `sdd-plugins` key
