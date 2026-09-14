---
spec-type: behavioral
concept: [canonical-manifest, axi]
---

# plugin validate — check the canonical manifest

Follows the AXI output contract ([../../axi/](../../axi/README.md)).

`universal-plugin plugin validate` checks the canonical root `plugin.json` (Agent Plugins
Specification v1.0.0 form) against the shared schema and each declared vendor's extra rules, without
deriving any output. It reports **all** violations at once so an author fixes them in one pass.
`plugin build` runs the same vendor rules eagerly before writing, from the same module
(`src/validate/validation.ts`), so the two never disagree about them.

The schema half follows the open standard, not a stricter house rule
([`agent-plugins.org/schemas/1.0.0/plugin.schema.json`](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)):
`$schema` and `name` are required, `name` matches the schema's pattern, the standard's fields carry
their types, and a top-level key the standard does not define (such as the pre-0.6
`vendorExtensions` block) is a violation, because tool-specific data belongs under `extensions`.
`version` is not a schema requirement. Codex requires it, so it is a codex vendor rule. The
`dependencies` declaration in the `org.cyberuni.universal-plugin` namespace is checked as a schema
violation too (ADR-0013). The rest of that namespace is not yet checked against
`schema/extension.schema.json`.

## Use Cases

**Subject** — checking the canonical manifest without deriving output:

- **Valid manifest passes** — a well-formed canonical manifest exits 0 with a definitive `valid:
  true` TOON result (never blank output).
- **Default output is TOON** — with no `--format`, a result carries `valid` plus pre-computed
  `schemaViolations` / `vendorViolations` rows (`field, rule, message`) and their aggregate counts
  on stdout; `--format json` stays the structured escape hatch.
- **Schema violations are reported together** — a missing required field (`$schema`, `name`) or a
  top-level key the standard does not define fails and names every violation, not just the first.
- **Vendor rules are enforced** — vendor-specific requirements (codex requires `description` and
  `version`) are checked; `--vendor <id>` limits the vendor-rule check to one vendor; an unknown
  `--vendor` value fails.
- **Unknown vendor keys warn, `--strict` escalates** — an unknown `harnesses` key warns
  (stderr) and exits 0; `--strict` promotes the warning to an error (exit 1) and to a violation row.
- **A large violation list truncates** — the default output truncates with a size hint (`… +N
  more — rerun with --full`); `--format json` and `--full` are never truncated.
- **`--format json`** — returns a structured result (`valid`, `schemaViolations[]`,
  `vendorViolations[]`) for CI consumption.
- **Missing manifest fails** — no root `plugin.json` exits 1 with a clear stderr message.
- **Next-step suggestions** — a passing run ends stderr with `→ universal-plugin plugin build`; a
  failing run ends stderr with a fix hint.
- **Content-first `plugin` group** — the bare `universal-plugin plugin` command (no subcommand)
  runs validate against the current project and reports live status plus the declared harnesses.
- **Non-interactive** — validate never prompts; it reads the manifest and reports, agent-safe by
  default.
- **Fail-loud unknown flag** — an unrecognized flag (e.g. `--frobnicate`) exits 1 and stderr names it.
- **`--help`** — answers with a concise synopsis, flags, and one example, exit 0.

**Non-goals** — deriving vendor manifests (`plugin build`); scaffolding a project (`plugin init`);
fixing the manifest automatically (validate only reports).

Every scenario in [`validate.feature`](./validate.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **valid manifest passes** | well-formed manifest exits 0 with a definitive TOON `valid: true` result (text + json) |
| **default output is TOON** | schema/vendor violation rows + aggregate on stdout by default |
| **schema violations together** | missing `$schema` / `name` reported together on stdout; unknown top-level key rejected |
| **vendor rules enforced** | codex description+version; `--vendor` scoping; unknown `--vendor` fails |
| **unknown keys warn / `--strict`** | unknown `harnesses` key warns (stderr) exit 0; `--strict` → exit 1 + violation row |
| **truncation + `--full`** | large violation list truncates with a size hint; json/`--full` never truncate |
| **`--format json`** | structured `valid` / `schemaViolations` / `vendorViolations` output |
| **missing manifest fails** | no root `plugin.json` → exit 1, stderr message |
| **next-step suggestions** | passing → `plugin build` hint; failing → fix hint (stderr) |
| **content-first `plugin` group** | bare `plugin` runs validate, reports harnesses |
| **non-interactive** | validate never prompts; agent-safe by default |
| **fail-loud unknown flag** | unrecognized flag → exit 1, stderr names it |
| **`--help`** | concise synopsis/flags/example, exit 0 |
