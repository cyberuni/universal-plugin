# GitHub Copilot CLI

Reads the **canonical root `plugin.json` directly**. The build derives nothing for it and writes no
file — `plugin build` reports it with status `canonical`, which is success, not a skipped target.

## Why nothing is derived

Copilot CLI searches four paths and takes the first match:

```
.plugin/plugin.json → plugin.json → .github/plugin/plugin.json → .claude-plugin/plugin.json
```

Root `plugin.json` — the canonical manifest — is second, so it always shadows the two below it. It
has consumed Open Plugin Spec v1 manifests since **v1.0.74** (2026-07-23, [changelog](https://github.com/github/copilot-cli/blob/main/changelog.md):
"Add support for Open Plugin Spec v1 plugin manifests and mcp.json configuration"), so it already
serves the canonical manifest as-is.

Earlier builds wrote `.github/plugin/plugin.json`. That path loses to root by construction and was
never read; a leftover copy is stale and safe to delete.

## Vendor-specific fields cannot be delivered

A `harnesses["copilot-cli"]` entry has nowhere to go. The canonical schema is closed
(`additionalProperties: false`), so a Copilot-only field cannot ride along in root, and there is no
derived file to put it in. The build warns:

```
harnesses.copilot-cli sets category, tags, but copilot-cli reads the canonical plugin.json
directly — these fields are not delivered
```

Treat that warning as a decision to make, not noise: either the field belongs to a vendor that has a
derived manifest, or it does not ship. Do not invent a path for it.

## `category` and `tags` belong to the catalog, not the manifest

A project on the pre-0.6 layout carries these on its **root** `plugin.json`, because root *was*
Copilot CLI's derived output. Adoption drops them from there, and that loses nothing — but not for
the reason the field table suggests.

**Copilot CLI has no `plugin.json` handling for either field.** Verified against the shipped
`@github/copilot-linux-x64` **1.0.83** runtime (the plugin loader is Rust in
`prebuilds/*/runtime.node`, not the bundled JS), and confirmed by running the binary. The manifest
validator carries a dedicated message for `keywords` and none for `category` or `tags`; both land on
the unknown-field path:

```
Plugin manifest "…": field "keywords" must be an array of strings (ignored)
Plugin manifest "…": unknown field "…" (ignored)
```

Unknown keys are **warn-and-ignore**: not rejected, not stripped from disk, dropped from the parsed
struct. A manifest carrying `category`, `tags`, and an outright bogus key installs cleanly with no
output about any of them. GitHub's published field table lists `category`/`tags` under the
`plugin.json` optional metadata fields anyway — as of 1.0.83 that part of the table does not match
the shipped loader.

**Where they are real is `marketplace.json`.** The catalog validator type-checks both on every
`plugins[]` entry, and a wrong type is a *fatal* browse failure, not a warning:

```
Failed to browse marketplace: Invalid marketplace.json:
  plugins.0.category: Expected string, received number,
  plugins.0.tags: Expected array, received string
```

With valid values, nothing renders them — `marketplace browse` prints only `name` and `description`,
and `plugins list --json` emits neither field, nor `keywords`. No list, search, sort, or filter in
the CLI touches any of them. GitHub's own marketplace (`github/copilot-plugins`, 17 curated entries)
sets `category` and `tags` zero times while populating `keywords` on 15 of 17.

### So where does a migrating project put them

| Was | Goes |
| --- | --- |
| `category` / `tags` on root `plugin.json` | fold into **`keywords`** — a spec field, in the closed set, and the one Copilot's manifest validator actually knows |
| the same values for marketplace discovery | the **catalog entry** in `marketplace.json`, where Copilot defines them |

Do not build a delivery path for these into the plugin manifest. There is nothing at the other end.

### Still open

- **Where the `unknown field (ignored)` warning surfaces.** It exists in the binary but reached no
  output on `plugin install`, `plugin list`, or `plugins list`. Likely the interactive dashboard or
  the session config-problems channel.
- **The full known-field allow-list for `plugin.json`.** The validator's field set is a Rust const
  array in a stripped binary; only fields with dedicated messages are recoverable. The negative is
  solid — neither `category` nor `tags` has any handling — but the positive list is not.
- **Server-side catalog search.** The runtime carries a remote catalog client with a `canSearch`
  capability. Whether GitHub's hosted catalog indexes `category`/`tags` is outside what the shipped
  code can answer, and it would be indexing `marketplace.json`, not a plugin manifest.
- **What `$schema` mode does to native-only fields.** The docs' "Open Plugin Spec support" section
  is an empty bullet list — born empty 2026-07-24, unchanged through five doc syncs and a human
  edit, so treat it as a stale docs artifact rather than a pending answer.

### Sources

- Shipped runtime: `@github/copilot-linux-x64` 1.0.83, `prebuilds/linux-x64/runtime.node`; validator
  strings and live `plugin install` / `marketplace browse` / `plugins list --json` runs.
- Copilot CLI plugin reference (the field table this contradicts):
  https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- GitHub's own catalog: https://github.com/github/copilot-plugins `.github/plugin/marketplace.json`
- Agent Plugins Specification v1.0.0 §8 (`extensions` is the sanctioned channel for non-spec data)
  and the closed field set: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json

## Do not

- **Do not delete root `plugin.json` to "clean up" a Copilot target.** It is the source of truth and
  the Copilot manifest at once.
- Do not write `.plugin/plugin.json`. It outranks root, so it would silently shadow the canonical
  manifest with a copy nothing regenerates. `plugin build` names it as a pre-0.6 signal and exits 1 —
  but only when nothing derived at all. A project whose other harnesses still build keeps the shadow
  and gets no warning, so this stays a rule you follow rather than one the tool enforces.

## Hooks

Copilot CLI accepts **either casing**, and the casing selects the payload format: PascalCase gets the
Claude-compatible format, so the canonical file reaches Copilot CLI unchanged. Because Copilot CLI
reads that file directly, the build derives nothing for it — an `agent` handler is reported as ignored
at runtime rather than dropped. See [`claude-code.md`](./claude-code.md).

## Dependencies

Copilot CLI reads no plugin dependency. Because it reads the canonical manifest directly, there is no
derived file to leave the declaration out of — it sits under `extensions`, which Copilot CLI ignores,
and the build reports it as ignored at runtime. See [`claude-code.md`](./claude-code.md).
