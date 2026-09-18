# marketplace — repository-local marketplace metadata

The `marketplace` command group generates deterministic **repository-local metadata** for vendor
marketplace workflows. It does not publish, register, install, authenticate, provision, or call a
remote service API. Those operations remain outside this package's charter.

- [`add/`](./add/README.md) — write a catalog entry for a plugin the repository does not hold, named
  by a path, a package, a forge slug or URL, or an entry another marketplace publishes.
- [`init/`](./init/README.md) — discover eligible root-level `plugin.json` manifests below approved
  scan roots and generate each vendor's marketplace catalog.
- [`validate/`](./validate/README.md) — check the catalogs a repository carries against the schema
  each vendor's runtime loads, and report the key at fault.

This is a descriptive group index (no `spec-type` marker); behavior lives in the unit nodes below.
