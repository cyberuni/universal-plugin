# plugin — the manifest command group

The `plugin` command group is the canonical-manifest engine. One canonical `plugin.json` at the
project root (Agent Plugins Specification v1.0.0 form) is the source of truth; these verbs turn it
into what each vendor expects and keep it well-formed:

- [`build/`](./build/README.md) — `universal-plugin plugin build` derives per-vendor manifests
  (dev-consumable form; no pins).
- [`bundle/`](./bundle/README.md) — `universal-plugin plugin bundle` materializes the release form,
  pinning the plugin's skill `npx <cli>@<version>` references to their shipping workspace versions.
- [`validate/`](./validate/README.md) — `universal-plugin plugin validate` checks the canonical
  manifest against the schema and vendor rules.
- [`init/`](./init/README.md) — `universal-plugin plugin init` scaffolds a new plugin project.
- [`install/`](./install/README.md) — `universal-plugin plugin install` puts the working copy into the
  runtimes the manifest declares, and `plugin uninstall` takes it back out.
- [`version/`](./version/README.md) — `universal-plugin plugin version` moves the plugin's version:
  it writes the two authored numbers and re-derives the rest through `build`'s writer.

> **Name note.** This `plugin` group is the manifest **authoring** engine (build / validate / init).
> It is **not** the old `plugin` install/registry verbs (`add` / `remove` / `update` / `find` /
> `search` / `list` / `migrate`) — those moved to the `cyberplace` package. The name was freed by
> that move and reused here. `install` here is the narrow local-development verb: it installs the
> working copy at the project root and resolves nothing by name (ADR-0012).

This is a descriptive group index (no `spec-type` marker) — the behavior lives in the unit nodes
below.
