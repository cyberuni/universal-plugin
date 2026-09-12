# GitHub Copilot CLI

Reads the **canonical root `plugin.json` directly**, so the build derives no vendor manifest for it.
It does derive its **components** — see [`com.github.copilot/` — the namespace directory](#comgithubcopilot--the-namespace-directory).
A plugin declaring none of the moved kinds is reported with status `canonical`, which is success, not
a skipped target.

## Why no manifest is derived

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
- **Extension, command, rule, and hook loading from the namespace directory** (below) was not
  observed directly — only agents were proven by experiment. The rest rests on GitHub's GA post.

### Sources

- Shipped runtime: `@github/copilot-linux-x64` 1.0.83, `prebuilds/linux-x64/runtime.node`; validator
  strings and live `plugin install` / `marketplace browse` / `plugins list --json` runs.
- Copilot CLI plugin reference (the field table this contradicts):
  https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- GitHub's own catalog: https://github.com/github/copilot-plugins `.github/plugin/marketplace.json`
- Agent Plugins Specification v1.0.0 §8 (`extensions` is the sanctioned channel for non-spec data)
  and the closed field set: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json

## `com.github.copilot/` — the namespace directory

Declaring the canonical `$schema` puts a plugin in **spec mode**, and spec mode changes where
Copilot CLI looks for its *native* components. They move out of the plugin root and into a
reverse-domain directory that other runtimes ignore by design:

```
com.github.copilot/agents/  commands/  rules/  hooks  extensions/
```

Spec components stay where the spec puts them: `skills/` and `mcp.json` remain at the plugin root.
Only Copilot-native kinds move. `extensions/` — canvas extensions, added in **1.0.79**
(2026-08-10) — is one subdirectory of it.

The directory pairs with the manifest key of the same name: `com.github.copilot/` carries Copilot's
*files*, `extensions["com.github.copilot"]` carries Copilot's *data* (§8). Same namespace, two
surfaces.

**This is a real delivery path, and it narrows the rule above.** "A Copilot-only field has nowhere
to go" still holds for **manifest fields** — the canonical schema is closed and that argument is
untouched. It does **not** hold for **content**: Copilot-specific agents, commands, rules, and hooks
have a sanctioned home, and `extensions["com.github.copilot"]` is the right place for Copilot
metadata.

The list above is the shape; these are the exact paths, and `lsp.json` belongs on it too:

| Component | Spec-mode path | Root still read |
| --- | --- | --- |
| agents | `com.github.copilot/agents/` | no |
| commands | `com.github.copilot/commands/` | no |
| rules | `com.github.copilot/rules/` | no |
| hooks | `com.github.copilot/hooks/hooks.json` | no |
| LSP servers | `com.github.copilot/lsp.json` | no |
| extensions (canvases) | `com.github.copilot/extensions/` | never had a root path |
| skills | `skills/` | **yes — does not move** |
| MCP servers | `mcp.json` | **yes — does not move** |

The namespace **replaces** the root rather than supplementing it, and an explicit component path in
the manifest does **not** opt back into root loading. The move landed in **1.0.80-0** and the
runtime's own changelog labels it breaking. Evidence and its confidence, including which kinds were
proven by experiment:
[`.research/copilot-spec-mode-namespace/`](../../../../../../.research/copilot-spec-mode-namespace/conclusion.md).
The published CLI plugin reference still says spec support is "additive on top of standard plugin
loading" and documents only the root layout — it is stale; do not build against it.

### What the build derives

`plugin build` derives the tree ([ADR-0015](../../../../.agents/spec/design/decisions/0015-copilot-spec-mode-namespace.md)),
so **authoring stays at the canonical locations**:

- `agents`, `commands` and `rules` are copied, resolved through the same `pathValue` contract
  `skills` uses, defaults included.
- Agents are **renamed** on the way. Copilot CLI reads `agents/` as `.agent.md` files while the
  canonical `agents/` is the Claude Code-shaped `*.md`, so a copy under the authored name would land
  a file the runtime ignores. Commands and rules keep their authored names — the runtime documents no
  extension for either.
- Hooks are **translated** into `com.github.copilot/hooks/hooks.json`, so a handler Copilot CLI
  cannot run is dropped from that file with a warning rather than reported as ignored at runtime.
- A declared `lspServers` **path** is copied to `com.github.copilot/lsp.json`. An **inline** map is
  not delivered: the file's top-level shape is undocumented, so the build warns instead of composing
  one.
- `com.github.copilot/extensions/` is the inverse — authored there, never derived, and left alone by
  `--clean`.

The vendor reports `built` at `com.github.copilot/` when it derives any of this, and keeps reporting
`canonical` at `plugin.json` when the plugin declares none of the moved kinds.

## Do not

- **Do not delete root `plugin.json` to "clean up" a Copilot target.** It is the source of truth and
  the Copilot manifest at once.
- Do not write `.plugin/plugin.json`. It outranks root, so it would silently shadow the canonical
  manifest with a copy nothing regenerates. `plugin build` names it as a pre-0.6 signal and exits 1 —
  but only when nothing derived at all. A project whose other harnesses still build keeps the shadow
  and gets no warning, so this stays a rule you follow rather than one the tool enforces.
- **Do not tell an author to move `agents/` into `com.github.copilot/`.** The root copy is the
  canonical input every other vendor derives from; the namespace is a build output. Moving it
  serves Copilot and strands the other three.
- **Do not hand-write the namespace directory.** `--clean` replaces everything the build derives
  under it. `extensions/` is the one subtree it leaves alone, and the only one to author there.

## Hooks

Copilot CLI accepts **either casing**, and the casing selects the payload format: PascalCase gets the
Claude-compatible format, so the canonical file needs no translation. It is written to
`com.github.copilot/hooks/hooks.json` all the same, because that is where spec mode reads it — so a
handler Copilot CLI cannot run is **dropped from that derived file** with a warning, like any other
vendor's. See [`claude-code.md`](./claude-code.md).

## Dependencies

Copilot CLI reads no plugin dependency. Because it reads the canonical *manifest* directly, there is
no derived manifest to leave the declaration out of — it sits under `extensions`, which Copilot CLI ignores,
and the build reports it as ignored at runtime. See [`claude-code.md`](./claude-code.md).
