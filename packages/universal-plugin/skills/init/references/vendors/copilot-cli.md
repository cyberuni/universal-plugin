# GitHub Copilot CLI

Reads the **canonical root `plugin.json` directly**. The build derives nothing for it and writes no
file — `plugin build` reports it with status `canonical`, which is success, not a skipped target.

## Why nothing is derived

Copilot CLI searches four paths and takes the first match:

```
.plugin/plugin.json → plugin.json → .github/plugin/plugin.json → .claude-plugin/plugin.json
```

Root `plugin.json` — the canonical manifest — is second, so it always shadows the two below it. It
has consumed Open Plugin Spec v1 manifests since v1.0.74, so it already serves the canonical manifest
as-is.

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

## Do not

- **Do not delete root `plugin.json` to "clean up" a Copilot target.** It is the source of truth and
  the Copilot manifest at once.
- Do not write `.plugin/plugin.json`. It outranks root, so it would silently shadow the canonical
  manifest with a copy nothing regenerates.

## Hooks

Copilot CLI accepts **either casing**, and the casing selects the payload format: PascalCase gets the
Claude-compatible format, so the canonical file reaches Copilot CLI unchanged. Because Copilot CLI
reads that file directly, the build derives nothing for it — an `agent` handler is reported as ignored
at runtime rather than dropped. See [`claude-code.md`](./claude-code.md).
