---
spec-type: behavioral
concept: [governance]
---

# governance — retired, pointing at `reference`

`universal-plugin governance` no longer resolves documents. `buddy-agent-harness reference
show|list|search` resolves them now, and a skill loads one with the `load-reference` skill in the
`buddy-agent-harness` plugin ([ADR-0017](../design/decisions/0017-retire-governance-for-reference.md)).
For one release every form of the command but `--help` prints where to go and exits 1. The release
after that removes the command.

The documents this package owns ship under `references/` at the package root, where the plugin tier
of `reference` reads them for any project that declares `universal-plugin` as a dependency or dev
dependency.

## Use Cases

**Actors** — an agent or a script still running `governance show <name>` or `governance list`, most
often from a skill written before the retirement, and the person who maintains that skill.

**Subject** — every form of the retired command points at its replacement; all but `--help` fail:

- **`show` names its replacement** — `governance show <name>` resolves nothing, prints nothing on
  stdout, and writes on stderr that the command is retired, then `→ buddy-agent-harness reference
  show <name>`, and the `load-reference` skill for use from a skill. It exits 1, so a caller that
  checks the exit code notices. With no name it names `<name>` as a placeholder.
- **`list` and bare `governance` name theirs** — each prints the same retirement line and `→
  buddy-agent-harness reference list`, and exits 1.
- **Old flags do not mask the message** — a caller passing the flags the command used to take
  (`--root`, `--format json`, `--json`) or any other flag gets the same retirement message and exit
  1, not an unknown-flag error, so an old skill is told where to go instead of what it typed wrong.
  The value after `--root` or `--format` is never read as the document name.
- **Help says it is retired** — `governance --help` exits 0 and says the command is retired and what
  replaces it.

**Non-goals** — resolving, listing, or searching documents (`buddy-agent-harness reference` owns
that); a fallback that still reads the old scopes; the removal itself, which is a later release's
change.

Every scenario in [`governance.feature`](./governance.feature) maps to one of these behaviors:

| Behavior | What it covers |
|---|---|
| **`show` names its replacement** | stdout empty, stderr retirement line and `→ buddy-agent-harness reference show <name>`, the `load-reference` skill named, exit 1; a document present at a former scope is not printed; no name gives the `<name>` placeholder |
| **`list` and bare `governance`** | retirement line and `→ buddy-agent-harness reference list`, exit 1 |
| **old flags** | `--root` before the name, `--format json`, the hidden `--json`, and an unknown flag each still get the retirement message and exit 1, the name read past a flag's value |
| **help** | `governance --help` exits 0 and names the replacement |
