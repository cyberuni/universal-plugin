---
spec-type: behavioral
concept: [canonical-manifest, axi]
---

# plugin build — derive per-vendor manifests

`universal-plugin plugin build` compiles the canonical root `plugin.json` (Agent Plugins Specification
v1.0.0 form) into one vendor-specific manifest per target vendor. Each vendor expects its manifest at
a different path and shape; maintaining one file per vendor lets shared fields drift. Build treats the
canonical manifest as the single source of truth and generates the rest, merging each vendor's
`extensions["org.cyberuni.universal-plugin"].harnesses.<vendor>` fields over the shared metadata and
component paths (harness wins on conflict). The canonical wrapper (`$schema`, `extensions`) and
`universal-plugin`'s own orchestration keys (`vendors`, `packagePath`, `harnesses`) never appear in a
derived manifest.

Build is the **dev-consumable** derivation — it runs constantly while authoring a plugin, is
deterministic, and needs no network. Producing the **release form** — pinning the `npx <cli>@<version>`
references a plugin's skills carry to the versions being shipped — is a separate release-time step that
lives in [`plugin bundle`](../bundle/README.md), not here (root `spec.md` placement map). Build does
not touch skill pins.

Follows the AXI output contract ([../../axi/](../../axi/README.md)).

## Use Cases

**Subject** — deriving vendor manifests from one canonical manifest, output per the AXI contract:

- **Target selection = `vendors ?? harnesses` keys** — with no filter, `plugin build` derives the
  `extensions["org.cyberuni.universal-plugin"].vendors` list when it is present, and otherwise falls
  back to every key declared in `harnesses`. Each target writes to its own path (`claude-code` →
  `.claude-plugin/plugin.json`, `cursor` → `.cursor-plugin/plugin.json`, `codex` →
  `.codex-plugin/plugin.json`).
- **`copilot-cli` derives nothing** — Copilot CLI searches `.plugin/plugin.json` → `plugin.json` →
  `.github/plugin/plugin.json` → `.claude-plugin/plugin.json` and takes the **first** match, so root
  `plugin.json` always shadows the lower two. Since Copilot CLI has consumed Open Plugin Spec v1
  manifests since v1.0.74, the canonical manifest serves it as-is. The build reports the vendor with
  status `canonical` and writes no file. A `harnesses.copilot-cli` override has no delivery path —
  the canonical manifest's schema is closed — so the build warns rather than dropping it silently.
- **Merge then strip** — per-harness fields from `harnesses.<vendor>` are merged over the shared
  metadata and component paths; the canonical wrapper (`$schema`, `extensions`) and the orchestration
  keys (`vendors`, `packagePath`, `harnesses`) never appear in output.
- **`--vendor` filters** — restricts the build to one selected vendor; a vendor not among the
  selected targets fails.
- **Validation is eager** — the manifest is validated before any file is written; codex requires
  `description` and `version`; a failure writes nothing and exits non-zero. A missing root
  `plugin.json` fails.
- **Unknown vendors warn, not error** — an unknown vendor key in `harnesses` is warned and
  skipped; no targets at all is a definitive empty state — exit 0, zero built rows.
- **`--dry-run` / `--clean`** — `--dry-run` resolves and validates but writes nothing; `--clean`
  removes an existing output file before rewriting it.
- **TOON by default, `--format json` escape hatch** — a successful build prints a TOON result to
  stdout, one row per vendor (`vendor, path, status`), plus a pre-computed aggregate summary
  (`built N, skipped M, failed K`, with `served by plugin.json N` appended when any vendor is
  `canonical`); `--format json` returns the same shape as structured JSON;
  `--format toon` names the default explicitly.
- **Definitive empty state** — no targets at all (neither `vendors` nor `harnesses`) still emits a
  TOON result on stdout (zero built rows, aggregate `built 0`) with exit 0, plus "nothing to build" on
  stderr.
- **Next-step suggestion** — a successful build's stderr ends with
  `→ universal-plugin plugin validate`.
- **Fail-loud, no prompts, help** — an unknown flag exits 1 naming the flag; the command never
  prompts interactively; `--help` exits 0 with a concise synopsis, flags, and one example.

**Non-goals** — checking a manifest without deriving output (`plugin validate`); scaffolding a new
project (`plugin init`); publishing or installing manifests (the `cyberplace` package); the shared
output-contract mechanics themselves ([`../../axi/`](../../axi/README.md) owns those); **resolving or
pinning the `npx <cli>@<version>` references a plugin's skills carry** — that is the release-time
[`plugin bundle`](../bundle/README.md) step, not a build step. Build derives manifests only.

Every scenario in [`build.feature`](./build.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **target selection (`vendors ?? harnesses`)** | builds the `vendors` list, else all `harnesses` keys; correct per-vendor output paths; copilot-cli derives nothing (canonical root serves it) |
| **merge then strip** | harness fields merged; canonical wrapper (`$schema`, `extensions`) + orchestration keys (`vendors`, `packagePath`, `harnesses`) stripped |
| **`--vendor` filters** | filter to one vendor; a `--vendor` not among the targets fails |
| **eager validation** | missing manifest fails; codex requires description + version |
| **unknown vendors warn** | unknown vendor key in `harnesses` skipped with warning |
| **`--dry-run` / `--clean`** | dry-run writes nothing; clean removes stale output before rewrite |
| **TOON default + aggregate (#1,#2,#4)** | stdout TOON, one row per vendor (`vendor, path, status`), pre-computed `built/skipped/failed` summary |
| **`--format json` / `--format toon`** | JSON escape hatch with `built` array + counts; `--format toon` names the default |
| **definitive empty state (#5)** | no targets → exit 0, TOON zero built rows + aggregate `built 0`, stderr "nothing to build" |
| **next-step suggestion (#9)** | successful build's stderr ends with `→ universal-plugin plugin validate` |
| **fail-loud unknown flag (#6)** | unknown flag exits 1, stderr names it |
| **`--help` (#10)** | exits 0, concise synopsis + flags + one example |
