# marketplace — repository-local marketplace metadata

The `marketplace` command group generates deterministic **repository-local metadata** for vendor
marketplace workflows. It does not publish, register, install, authenticate, provision, or call a
remote service API. Those operations remain outside this package's charter.

- [`init/`](./init/README.md) — discover eligible root-level `plugin.json` manifests below approved
  scan roots and generate each vendor's marketplace catalog.
- [`validate/`](./validate/README.md) — check the catalogs a repository carries against the schema
  each vendor's runtime loads, and report the key at fault.

This is a descriptive group index (no `spec-type` marker); behavior lives in the unit nodes below.
