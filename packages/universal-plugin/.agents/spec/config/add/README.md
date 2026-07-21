---
spec-type: behavioral
concept: [config, axi]
---

# config add — register a keyed config entry

`universal-plugin config add --key <key> --entry '<json>'` registers one entry into the array at
`<key>` in `.agents/universal-plugin.json`. It is the **install-time write** half of the plugin
config mechanism: a plugin's install/init flow calls it to announce metadata that other plugins
discover later via [`config get`](../get/README.md).

Each key holds an **array of entry objects**. `add` is **idempotent for re-installs**: it appends the
entry if no existing element shares its `name`, and replaces the existing element in place if one
does. Because the merge dedupes on `name`, `--entry` **must** be a JSON object carrying a `name`
field — that is the operation's own precondition, not consumer-schema enforcement. No other field is
inspected or validated (the key's schema is the consumer's).

Writing never disturbs the rest of the file: `packagePath`, other plugins' keys, and any unknown
top-level fields are all preserved. A missing file or a missing key is created.

Follows the AXI output contract ([../../axi/](../../axi/README.md)).

## Use Cases

**Subject** — appending or replacing (by `name`) an entry in the array at a key in
`.agents/universal-plugin.json`, output per the AXI contract:

- **Append a new entry** — with a `--key` that has no matching-`name` element, the entry is appended
  to the array; a key that does not yet exist is created with a single-element array.
- **Replace by name (idempotent)** — an `--entry` whose `name` matches an existing element replaces
  that element in place (same array position), so re-running an install is a no-op-shaped update, not
  a duplicate.
- **Create the file if absent** — with no `.agents/universal-plugin.json` at the resolved root, `add`
  creates it containing just the new key; the resolved root is the cwd.
- **Preserve every other key** — the write leaves `packagePath`, other keys' arrays, and any unknown
  top-level fields untouched; only the target key's array changes.
- **Reject the reserved key** — `--key packagePath` exits non-zero naming the reserved key and writes
  nothing; `packagePath` is the CLI's own string config, not a plugin-registered array, so `config
  add` never coerces it into an array.
- **Require a name** — an `--entry` with no `name` field exits non-zero naming the requirement and
  writes nothing; an `--entry` that is not a JSON object, or not valid JSON, likewise fails and writes
  nothing.
- **Missing flags fail loud** — a missing `--key` or missing `--entry` exits non-zero naming the
  missing flag; the command never prompts interactively.
- **TOON by default, `--format json` escape hatch** — a successful add prints a TOON result to
  stdout, one row for the written entry (`key, name, action`) where `action` is `appended` or
  `replaced`, plus a pre-computed aggregate (`<key>: N entries`); `--format json` returns the same
  shape as structured JSON; `--format toon` names the default explicitly.
- **Next-step suggestion** — a successful add's stderr ends with
  `→ universal-plugin config get --key <key>`.
- **Fail-loud, help** — an unknown flag exits 1 naming the flag; `--help` exits 0 with a concise
  synopsis, flags, and one example.

**Non-goals** — reading entries back ([`config get`](../get/README.md)); removing an entry (no remove
verb in v1 — deferred until a plugin uninstall flow exists); validating the entry's shape beyond
valid JSON + a `name` field (each key's schema is its consumer's); the shared output-contract
mechanics themselves ([`../../axi/`](../../axi/README.md) owns those).

Every scenario in [`add.feature`](./add.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **append a new entry** | append when no name matches; create key if absent |
| **replace by name** | matching-name entry replaced in place (position preserved); idempotent re-install |
| **create the file if absent** | no config file → created with just the new key |
| **preserve every other key** | packagePath / other keys / unknown fields untouched |
| **reject the reserved key** | `--key packagePath` fails, writes nothing |
| **require a name** | no-name / non-object / invalid-JSON entry fails, writes nothing |
| **missing flags fail loud** | missing --key or --entry exits non-zero naming the flag |
| **TOON default + aggregate** | stdout TOON row (`key, name, action`) + `<key>: N entries` aggregate |
| **`--format json` / `--format toon`** | JSON escape hatch; `--format toon` names the default |
| **next-step** | stderr ends `→ universal-plugin config get --key <key>` |
| **fail-loud + help** | unknown flag exits 1 naming it; `--help` exits 0 with synopsis + example |
