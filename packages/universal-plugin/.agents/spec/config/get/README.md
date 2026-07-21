---
spec-type: behavioral
concept: [config, axi]
---

# config get — read a keyed config array

`universal-plugin config get --key <key>` reads the array registered at `<key>` in
`.agents/universal-plugin.json`. It is the **runtime read** half of the plugin config mechanism: a
consumer plugin calls it lazily, at delegation time, to discover what other plugins registered via
[`config add`](../add/README.md) — no per-session load, no coupling to specific plugin names.

The full array is available as raw JSON for programmatic consumers via `--format json` (they parse it
themselves). The default output follows the AXI contract: a TOON table keyed on each entry's `name`
(guaranteed present, since [`config add`](../add/README.md) requires it) plus a pre-computed count, so
a human or agent scanning the file sees what is registered without piping through a JSON parser.

Read-only: `get` never writes the file and resolves `.agents/universal-plugin.json` from the current
working directory.

Follows the AXI output contract ([../../axi/](../../axi/README.md)).

## Use Cases

**Subject** — reading the array at a key in `.agents/universal-plugin.json`, output per the AXI
contract:

- **Read entries at a key** — `config get --key <key>` prints the entries registered at `<key>`; the
  resolved root is the cwd.
- **TOON by default** — the default output is a TOON result on stdout, one row per entry keyed on
  `name`, plus a pre-computed aggregate (`<key>: N entries`).
- **`--format json` returns the raw array** — `--format json` prints the exact array as stored to
  stdout (never truncated), the form a consumer parses programmatically; `--format toon` names the
  default explicitly.
- **Definitive empty state** — a key that is absent, or present with an empty array, prints a TOON
  result with zero rows and aggregate `0 entries` on stdout with exit 0 (`--format json` prints `[]`);
  a missing `.agents/universal-plugin.json` is treated the same as an absent key — exit 0, empty.
- **Reject the reserved key** — `--key packagePath` exits non-zero naming the reserved key; it is the
  CLI's own string config, not a plugin-registered array, so `config get` never returns it as one.
- **Missing --key fails loud** — a missing `--key` exits non-zero naming the flag; the command never
  prompts interactively.
- **Next-step suggestion** — `get`'s stderr ends with `→ universal-plugin config add --key <key> --entry <json>`.
- **Fail-loud, help** — an unknown flag exits 1 naming the flag; `--help` exits 0 with a concise
  synopsis, flags, and one example.

**Non-goals** — writing or removing entries ([`config add`](../add/README.md) owns the write); reading
a single element by name or filtering within a key (the consumer parses the array itself); reading
`universal-plugin`'s own reserved key as config (`packagePath` is the CLI's own string config, not a
plugin-registered array — both verbs reject `--key packagePath`); the shared output-contract mechanics themselves
([`../../axi/`](../../axi/README.md) owns those).

Every scenario in [`get.feature`](./get.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **read entries at a key** | prints the array registered at the key |
| **TOON default + aggregate** | stdout TOON, one row per entry keyed on `name`, `<key>: N entries` |
| **`--format json` raw array** | exact stored array to stdout, untruncated; `--format toon` names default |
| **definitive empty state** | absent key / empty array / missing file → 0 rows, exit 0 (`[]` under json) |
| **reject the reserved key** | `--key packagePath` fails naming the reserved key |
| **missing --key fails loud** | missing `--key` exits non-zero naming the flag |
| **next-step** | stderr ends `→ universal-plugin config add --key <key> --entry <json>` |
| **fail-loud + help** | unknown flag exits 1 naming it; `--help` exits 0 with synopsis + example |
