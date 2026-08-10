---
spec-type: behavioral
concept: [marketplace, axi]
---

# marketplace init — generate repository-local marketplace metadata

`universal-plugin marketplace init` discovers root-level `plugin.json` manifests only within
allowlisted scan directories and deterministically writes vendor marketplace metadata. It is a
local derivation command, never a publisher or service client.

## Use Cases

**Subject** — safe, repeatable repository metadata generation:

- **Default catalogs** — without target selectors, generate Claude, Codex, and Copilot catalogs;
  report Cursor as `skipped-default` because Cursor requires an explicit submission scaffold.
- **Explicit target union** — any combination of `--claude`, `--codex`, `--copilot`, and `--cursor`
  generates exactly that target union. `--cursor` writes local submission metadata plus a Markdown
  handoff that links the Cursor dashboard and plainly says no publication or provisioning occurred.
- **Bounded discovery** — scan `<root>/plugins` by default (a missing default is an empty success),
  or repeated `--plugin-scan-dir` values resolved inside `--root`; explicitly requested directories
  must exist. Only root-level plugin manifests below those directories are catalog candidates;
  `.plugin/`, `.claude-plugin/`, `.codex-plugin/`, and `.cursor-plugin/` manifests are excluded.
- **Validated metadata** — derive the marketplace name from the root directory and owner from the
  root `plugin.json` author unless flags override. Fail before writing for invalid JSON, invalid
  names, duplicate plugin identities, invalid scan roots, or any out-of-root source.
- **Deterministic catalogs** — Claude writes `.claude-plugin/marketplace.json`; Codex writes
  `.agents/plugins/marketplace.json` with its local source and installation/authentication policy;
  Copilot writes `.github/plugin/marketplace.json`; Cursor writes its explicitly selected scaffold.
  Sources are `./`-prefixed repository-relative paths and available common manifest metadata is
  preserved where the catalog format supports it.
- **Two-phase outcomes** — preflight all selected outputs before atomically writing any. Equivalent
  JSON is `unchanged`; differing selected output fails with a `--force` hint; `--force` replaces
  only selected artifacts; `--dry-run` writes nothing. Results contain `target`, `status`, `paths`,
  `plugins`, and optional `reason`, with `generated`, `unchanged`, `planned`, `skipped-default`, or
  `empty` statuses.
- **AXI output** — TOON is the default and `--format json` returns the same result structure. Data
  goes to stdout; diagnostics and the local-only/non-provisioning next step go to stderr.

**Non-goals** — publishing or registering a marketplace, plugin installation, authentication,
token management, remote service APIs, vendor dashboard automation, or validating each discovered
plugin's eventual vendor-install compatibility.

Every scenario in [`init.feature`](./init.feature) maps to these behaviors.
