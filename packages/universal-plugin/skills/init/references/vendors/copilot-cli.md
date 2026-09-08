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

## `category` and `tags` — recognized, but nothing is known to read them

A project on the pre-0.6 layout carries these on its **root** `plugin.json`, because root *was*
Copilot CLI's derived output. Adoption drops them: root becomes the canonical manifest and the spec
field set is closed. This is what that costs, as far as the published evidence goes — checked
2026-09-07.

- **They are not unknown keys.** Copilot CLI's own plugin reference documents both under the
  *Optional metadata fields* of `plugin.json`: `category` (string, "Plugin category") and `tags`
  (string array, "Additional tags"). It documents them again as marketplace **entry** fields, so
  "they were only ever catalog fields" is not the explanation either. Do not tell a user Copilot
  ignores them as unknown keys — its own field table contradicts that.
- **Nothing in Copilot's documentation consumes either one.** Neither field appears in the
  finding/installing, marketplace, or plugin-authoring how-to pages, nor in the canonical example
  manifest, and no described behavior reads them — no listing, no search, no filtering. `keywords`,
  by contrast, is documented as search keywords.
- **In spec mode a conformant client may not act on them anyway.** Declaring the canonical `$schema`
  opts the plugin into Agent Plugins Spec v1.0.0, which requires a client to report and ignore each
  unknown top-level field and states that clients **must not** assign semantics to unknown fields
  (§5.2, restated non-fatal in §11.3).

**Working answer: dropping `category` and `tags` costs nothing observable.** Say that to a user
mid-migration rather than leaving them to guess whether they just lost something — but say it as what
it is, an argument from the vendor's published behavior, not a guarantee.

### Open questions

These were not established. Re-check them before anyone relies on more than the paragraph above.

- Whether Copilot CLI's loader **reads** `category`/`tags` at runtime or merely documents them. The
  shipped code is a ~300 MB per-platform binary package (`@github/copilot` is a launcher shim); no
  bundle inspection was done.
- Whether declaring the spec `$schema` **changes** how native extras are handled. Copilot's docs say
  spec support is layered "additively on top of standard plugin loading", but the bullet list that
  would explain what that means is empty in the published source.
- Whether Copilot **surfaces** either field anywhere — `/plugin`, marketplace browse, install
  listings. Nothing in its docs says it does.

### Sources

- Copilot CLI plugin reference — the `plugin.json` field table and the Open Plugin Spec section:
  https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- Agent Plugins Specification v1.0.0 §5.2 and §11.3:
  https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md
- The canonical schema's closed field set (`additionalProperties: false`, ten properties, no
  `category`/`tags`): https://agent-plugins.org/schemas/1.0.0/plugin.schema.json

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
