---
'universal-plugin': minor
---

Stop vendoring the Agent Plugins Specification manifest schema; ship a schema for only the
`org.cyberuni.universal-plugin` extension namespace.

The repository carried `schema/v1.json`, a local fork of the upstream Agent Plugins Specification
v1.0.0 manifest schema. Every `plugin.json` already declares the published schema
(`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`), so the fork added nothing on the
envelope and could only drift from a spec this project does not own.

Upstream deliberately assigns no semantics inside `extensions[<namespace>]`, and that is where all
of this tool's configuration lives. The file is therefore split along the ownership line: the
envelope copy is deleted, and the namespace body is retained as
`schema/extension.schema.json`, now shipped in the package so a consumer resolving these fields
against an installed dependency can validate against a schema instead of reimplementing the rule.

Validating that namespace for the first time surfaced two defects, both fixed:

- `plugin build` resolved only the string form of a component path. The array and
  `{ "paths": [...] }` forms — both valid — fell through to `./skills/` without complaint, so a
  plugin declaring its skills either way had them silently left underived. All three forms now
  resolve, every declared directory is searched, and a declared directory that does not exist warns
  instead of being replaced by the default.
- The per-harness override blocks were a closed field set while the build copies each one verbatim
  into the derived manifest. A harness field newer than the schema now rides along rather than being
  rejected.
