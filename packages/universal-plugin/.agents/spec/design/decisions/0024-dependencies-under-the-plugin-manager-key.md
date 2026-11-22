# 0024 — Plugin dependencies are read from the `io.github.cyber-uni.plugin-manager` key

**Status:** accepted
**Date:** 2026-11-22
**Supersedes:** the extension key in [0013](./0013-plugin-dependencies.md) §1. The rest of 0013 stands.
**Checked against:** [0018](./0018-build-checks-dependencies-against-catalogs.md).

## Context

[Issue #308](https://github.com/cyber-uni/universal-plugin/issues/308). 0013 put a plugin's dependency
list in `extensions["org.cyberuni.universal-plugin"].dependencies`, beside every other universal-plugin
field, and `plugin build` writes it into the Claude Code manifest from there.

cyber-agentkit also reads that list, to report which dependencies a plugin is missing. Its
[decision 0002](https://github.com/cyber-uni/cyber-agentkit/blob/main/packages/cyber-agentkit/.agents/spec/design/decisions/0002-extension-key-on-cyber-uni.md)
gives the list a key of its own, `io.github.cyber-uni.plugin-manager`. It reads that key first and
falls back to `org.cyberuni.universal-plugin`.

The build reads only the old key. A plugin that moves its list to the new key, as cyber-agentkit
asks, loses its Claude Code `dependencies` on the next build, and Claude Code stops installing them.

## Decision

### 1. The dependency list has one key, shared by both tools

The build reads `extensions["io.github.cyber-uni.plugin-manager"].dependencies`. The list is a feature
of its own, not universal-plugin build configuration: two tools read it, and neither owns the other's
key. One key per feature lets each tool change its own key without touching the other's, which is
cyber-agentkit's reason for the key, and the Agent Plugins Specification's rule that a client ignores
namespaces it does not implement keeps working.

The shape of the list is unchanged: 0013 §2's array, validated as 0013 §4 says.

### 2. `org.cyberuni.universal-plugin` stays the fallback

When the new key declares no `dependencies`, the build reads the old key's list, with no warning.
Plugins on the old key build as before, and can move when they choose.

### 3. When both keys declare a list, the new key wins

The build reads the new key's list, warns that the old key's list is ignored, and asks the author to
remove it. It does not merge the two lists: a merge would keep a dependency the author removed from
the new list. It does not fail: the manifest is valid, and the warning says what to do.

A list is declared when the key carries `dependencies`, even an empty array, so an author can clear
the list under the new key. cyber-agentkit treats an empty list as absent and reads the old one. The
warning shows that case to the author, who resolves it by removing the old list.

### 4. Every reader of the list reads the same key

`plugin build`, `plugin validate`, and `marketplace validate` read the list through one function,
`readDeclaredDependencies` in `src/dependencies/`. A shape error is reported against the key the list
came from. A list in `harnesses["claude-code"].dependencies` still overrides either key for Claude
Code, as 0013 §1 says.

## 0018 checked against this decision

0018 checks the declaration a vendor receives against the catalogs the build refreshes, and lists a
dependency that declares its `source`. Both read the declaration this decision selects, so 0018 holds
unchanged: the check follows the list to its new key. Its examples still name the old key's list as
"the canonical declaration", which now means the list under whichever key this decision reads.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Keep reading only `org.cyberuni.universal-plugin` | A plugin that follows cyber-agentkit's key loses its Claude Code dependencies. |
| Read only the new key | Every plugin on the old key loses its dependencies on the next build. |
| Merge the two lists | Keeps a dependency the author removed from the new list, and gives the list two homes. |
| Fail the build when both keys declare a list | The manifest is valid. A warning names the fix, as the rest of the build does ([0011](./0011-warn-and-drop-unrepresentable-hook-handlers.md)). |
| Let the old key win | It reverses the move the new key exists for, and disagrees with cyber-agentkit. |

## Consequences

- The docs show the new key. The old key is documented as the fallback.
- A plugin with a list under both keys sees a warning on every build until it removes the old list.
- `schema/extension.schema.json` still describes `dependencies` under `org.cyberuni.universal-plugin`.
  The new key's schema belongs to cyber-agentkit.
- Dropping the fallback is a breaking change and needs its own decision.
