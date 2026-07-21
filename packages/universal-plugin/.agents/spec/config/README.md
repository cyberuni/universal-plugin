# config — the plugin-registered config command group

The `config` command group reads and writes **keyed configuration entries** into
`.agents/universal-plugin.json` — the file `universal-plugin` already uses for its own config
(`packagePath`). Plugins write entries at **install time**; consumers read them **lazily**
at delegation time, so cross-plugin discovery needs no per-session load.

- [`add/`](./add/README.md) — `universal-plugin config add --key <key> --entry '<json>'` appends an
  entry to the array at `<key>`, or replaces the element whose `name` matches (idempotent for
  re-installs).
- [`get/`](./get/README.md) — `universal-plugin config get --key <key>` reads the array at `<key>`.

Each key holds an **array of free-form entry objects**. The CLI does not enforce an entry schema
beyond valid JSON and a required `name` field (the merge key `add` dedupes on) — each key's own
schema is owned by its consumer (e.g. the SDD plugin defines what an `sdd-plugins` entry must carry).
Both verbs resolve `.agents/universal-plugin.json` from the current working directory and **preserve
every other top-level key** on write.

**Reserved key.** `packagePath` is the CLI's own config (a **string**, read by `publish sync-version`),
not a plugin-registered array. Both verbs **reject** `--key packagePath`, failing loud rather than
coercing it into config's array shape — a wrong `packagePath` is fixed by editing the file directly,
never via `config`.

Follows the AXI output contract ([../axi/](../axi/README.md)).

This is a descriptive group index (no `spec-type` marker) — the behavior lives in the two unit nodes
below.
