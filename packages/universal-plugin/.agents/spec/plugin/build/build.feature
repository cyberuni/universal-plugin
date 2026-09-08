@frozen
Feature: plugin build — derive per-vendor manifests

  Background:
    Given a project root with a canonical "plugin.json"

  # ── Derive vendor manifests ──

  Scenario: builds all declared harnesses
    Given the manifest declares harnesses for "claude-code" and "cursor"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" is written
    And ".cursor-plugin/plugin.json" is written
    And the exit code is 0

  Scenario: the vendors list selects the build targets when present
    Given the manifest declares harnesses for "claude-code", "cursor", and "codex"
    And the extensions vendors list is "claude-code" and "cursor"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" is written
    And ".cursor-plugin/plugin.json" is written
    And ".codex-plugin/plugin.json" is NOT written
    And the exit code is 0

  Scenario: build falls back to all harnesses keys when no vendors list is present
    Given the manifest declares harnesses for "claude-code" and "cursor"
    And the manifest has no extensions vendors list
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" is written
    And ".cursor-plugin/plugin.json" is written
    And the exit code is 0

  # Copilot CLI checks .plugin/plugin.json -> plugin.json -> .github/plugin/plugin.json ->
  # .claude-plugin/plugin.json and takes the first match, so root shadows the lower two. Copilot CLI
  # reads Open Plugin Spec v1 manifests as of v1.0.74, so the canonical manifest serves it directly.
  # Its components are a separate question — see the spec-mode namespace section (ADR-0015).
  Scenario: copilot-cli derives no manifest — the canonical root manifest serves it
    Given the manifest declares harnesses for "copilot-cli"
    And the extensions namespace declares only skills "./skills/"
    When I run "universal-plugin plugin build"
    Then no ".github/plugin/plugin.json" is written
    And the canonical "plugin.json" is left unchanged
    And "copilot-cli" is reported with status "canonical"
    And the exit code is 0

  Scenario: a copilot-cli harness override warns that it cannot be delivered
    Given the manifest declares harnesses for "copilot-cli" with category "dev"
    When I run "universal-plugin plugin build"
    Then a warning names "harnesses.copilot-cli" and the undelivered field "category"
    And the exit code is 0

  Scenario: harness-specific fields are merged into output
    Given the manifest has name "my-plugin" and skills "./skills/"
    And harnesses.claude-code has displayName "My Plugin"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" contains name "my-plugin"
    And ".claude-plugin/plugin.json" contains skills "./skills/"
    And ".claude-plugin/plugin.json" contains displayName "My Plugin"

  Scenario: the canonical wrapper and orchestration keys are stripped from output
    Given the manifest has a $schema field
    And the extensions namespace carries "vendors", "packagePath", and "harnesses"
    When I run "universal-plugin plugin build"
    Then the output file does not contain "$schema"
    And the output file does not contain "extensions"
    And the output file does not contain "harnesses"
    And the output file does not contain "vendors"
    And the output file does not contain "packagePath"

  # ── Component path resolution (the extension's pathValue contract) ──
  #
  # `skills`, like every pathValue-typed field in extensions["org.cyberuni.universal-plugin"], is a
  # single "./" path string, an array of those strings, or a { "paths": [...] } object. Build reads
  # the skills it declares in order to derive each vendor's skill artifacts, so a form the build does
  # not resolve is a plugin whose skills are silently left underived.

  Scenario: a skills path string is resolved
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares skills as the string "./my-skills/"
    And "./my-skills/alpha/SKILL.md" declares invocation-policy "user"
    When I run "universal-plugin plugin build"
    Then "./my-skills/alpha/SKILL.md" carries "disable-model-invocation: true"
    And the exit code is 0

  Scenario: a skills path array is resolved across every declared directory
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares skills as the array "./a-skills/" and "./b-skills/"
    And "./a-skills/alpha/SKILL.md" declares invocation-policy "user"
    And "./b-skills/beta/SKILL.md" declares invocation-policy "user"
    When I run "universal-plugin plugin build"
    Then "./a-skills/alpha/SKILL.md" carries "disable-model-invocation: true"
    And "./b-skills/beta/SKILL.md" carries "disable-model-invocation: true"
    And the exit code is 0

  Scenario: a skills paths object is resolved across every declared directory
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares skills as a paths object listing "./a-skills/" and "./b-skills/"
    And "./a-skills/alpha/SKILL.md" declares invocation-policy "user"
    And "./b-skills/beta/SKILL.md" declares invocation-policy "user"
    When I run "universal-plugin plugin build"
    Then "./a-skills/alpha/SKILL.md" carries "disable-model-invocation: true"
    And "./b-skills/beta/SKILL.md" carries "disable-model-invocation: true"
    And the exit code is 0

  Scenario: a declared skills path is never silently replaced by the default directory
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares skills as the array "./a-skills/"
    And "./a-skills/alpha/SKILL.md" declares invocation-policy "user"
    And "./skills/ignored/SKILL.md" declares invocation-policy "user"
    When I run "universal-plugin plugin build"
    Then "./a-skills/alpha/SKILL.md" carries "disable-model-invocation: true"
    And "./skills/ignored/SKILL.md" does NOT carry "disable-model-invocation: true"
    And the exit code is 0

  Scenario: skills fall back to "./skills/" only when the namespace declares none
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares no skills path
    And "./skills/alpha/SKILL.md" declares invocation-policy "user"
    When I run "universal-plugin plugin build"
    Then "./skills/alpha/SKILL.md" carries "disable-model-invocation: true"
    And the exit code is 0

  Scenario: a declared skills directory that does not exist is warned about, not skipped in silence
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares skills as the array "./a-skills/" and "./missing/"
    And "./a-skills/alpha/SKILL.md" declares invocation-policy "user"
    And "./missing/" does not exist
    When I run "universal-plugin plugin build"
    Then a warning names the skills path "./missing/"
    And "./a-skills/alpha/SKILL.md" carries "disable-model-invocation: true"
    And the exit code is 0

  Scenario: a skills declaration in none of the three forms is warned about and reads nothing
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares skills as the number 7
    And "./skills/alpha/SKILL.md" declares invocation-policy "user"
    When I run "universal-plugin plugin build"
    Then a warning says the skills declaration is not a path, a path list, or a paths object
    And "./skills/alpha/SKILL.md" does NOT carry "disable-model-invocation: true"
    And the exit code is 0

  Scenario: an absent default skills directory is not warned about
    Given the manifest declares harnesses for "claude-code"
    And the extensions namespace declares no skills path
    And "./skills/" does not exist
    When I run "universal-plugin plugin build"
    Then no warning names a skills path
    And the exit code is 0

  # ── Hook translation (ADR-0011) ──

  # Claude Code and Codex read PascalCase and the canonical matcher-group shape; Cursor reads
  # camelCase and a flat handler list; Copilot CLI accepts PascalCase as its Claude-compatible
  # payload format. Handler support: Claude Code all four canonical types, Codex command only,
  # Cursor command and prompt, Copilot CLI command, http, and prompt.
  # (.research/hook-event-survey/conclusion.md, re-verified August 2026)
  Scenario: claude-code keeps the canonical hooks file when nothing needs translating
    Given the manifest declares hooks "./hooks/hooks.json" with a "SessionStart" command handler
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then no hooks file is derived for "claude-code"
    And ".claude-plugin/plugin.json" contains hooks "./hooks/hooks.json"
    And the exit code is 0

  Scenario: cursor gets a derived hooks file with camelCase event names
    Given the manifest declares hooks "./hooks/hooks.json" with a "SessionStart" command handler
    And the manifest declares harnesses for "cursor"
    When I run "universal-plugin plugin build"
    Then ".cursor-plugin/hooks.json" is written
    And it contains the event name "sessionStart"
    And it does not contain the event name "SessionStart"
    And ".cursor-plugin/plugin.json" contains hooks "./.cursor-plugin/hooks.json"
    And the authored "hooks/hooks.json" is left unchanged

  Scenario: a cursor hooks file carries the schema version and flattens matcher groups
    Given the authored hooks declare one matcher group with matcher "Write" and two command handlers
    And the manifest declares harnesses for "cursor"
    When I run "universal-plugin plugin build"
    Then ".cursor-plugin/hooks.json" contains "version" 1
    And the event holds two flat handler entries
    And each entry carries the matcher "Write"

  Scenario: codex drops a handler type it cannot run, and warns
    Given the authored hooks declare one command handler and one prompt handler on "SessionStart"
    And the manifest declares harnesses for "codex"
    When I run "universal-plugin plugin build"
    Then a warning names "codex", "SessionStart", and the dropped type "prompt"
    And ".codex-plugin/hooks.json" holds only the command handler
    And the exit code is 0

  Scenario: cursor drops an http handler, and warns
    Given the authored hooks declare one http handler on "SessionStart"
    And the manifest declares harnesses for "cursor"
    When I run "universal-plugin plugin build"
    Then a warning names "cursor", "SessionStart", and the dropped type "http"
    And the exit code is 0

  # Copilot CLI now has a derived hooks file of its own at the spec-mode path (ADR-0015 revises
  # ADR-0011 §3), so a handler it cannot run is dropped from that file rather than left in place.
  Scenario: copilot-cli drops an unsupported handler from its derived namespace file
    Given the authored hooks declare one agent handler on "SessionStart" and one command handler on "Stop"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then a warning names "copilot-cli", "SessionStart", and the dropped type "agent"
    And "com.github.copilot/hooks/hooks.json" does not contain "SessionStart"
    And "com.github.copilot/hooks/hooks.json" contains "Stop"
    And the canonical "plugin.json" is left unchanged
    And the exit code is 0

  Scenario: an event left with no runnable handler is omitted from the derived file
    Given the authored hooks declare a prompt handler on "SessionStart" and a command handler on "Stop"
    And the manifest declares harnesses for "codex"
    When I run "universal-plugin plugin build"
    Then ".codex-plugin/hooks.json" does not contain "SessionStart"
    And ".codex-plugin/hooks.json" contains "Stop"

  Scenario: a hooks file with nothing left is not written and the hooks field is omitted
    Given the authored hooks declare only an http handler on "SessionStart"
    And the manifest declares harnesses for "codex"
    When I run "universal-plugin plugin build"
    Then no hooks file is derived for "codex"
    And ".codex-plugin/plugin.json" has no "hooks" field
    And the exit code is 0

  Scenario: inline hooks in the manifest are translated too
    Given the manifest declares hooks inline with a "SessionStart" command handler
    And the manifest declares harnesses for "cursor"
    When I run "universal-plugin plugin build"
    Then ".cursor-plugin/hooks.json" is written
    And ".cursor-plugin/plugin.json" contains hooks "./.cursor-plugin/hooks.json"

  Scenario: --dry-run derives no hooks file
    Given the manifest declares hooks "./hooks/hooks.json" with a "SessionStart" command handler
    And the manifest declares harnesses for "cursor"
    When I run "universal-plugin plugin build --dry-run"
    Then ".cursor-plugin/hooks.json" is NOT written
    And the exit code is 0

  # ── MCP invocation pinning (issue #56) ──

  Scenario: a marked mcpServers entry is pinned to the manifest version
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y", "cyber-asana@0.10.0", "mcp"
    And the exit code is 0

  Scenario: the marker is stripped from the derived manifest
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" does not contain "pinToPluginVersion"
    And the canonical "plugin.json" is left unchanged

  # The marker is required precisely because a plugin may publish its server under a package name
  # that is not the plugin's own, so a name match would be unsound in both directions.
  Scenario: an unmarked entry is left alone
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y", "cyber-asana", "mcp"
    And the exit code is 0

  Scenario: an unrelated invocation beside a marked one is not stamped
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares an mcpServers entry "other" running "npx" with args "-y", "some-other-cli"
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "other" has args "-y", "some-other-cli"

  Scenario: a scoped package name keeps its scope when pinned
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "--yes", "@cyberuni/server", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "--yes", "@cyberuni/server@0.10.0", "mcp"

  Scenario: an already-pinned specifier is overwritten with a warning
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana@0.9.0", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y", "cyber-asana@0.10.0", "mcp"
    And stderr contains "0.9.0"
    And the exit code is 0

  Scenario: a specifier already at the manifest version is rewritten without a warning
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana@0.10.0", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y", "cyber-asana@0.10.0", "mcp"
    And stderr does not contain "pinToPluginVersion"

  Scenario: an args list carrying no runner flag is pinned at its first argument
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "cyber-asana@0.10.0", "mcp"
    And the exit code is 0

  # `upx` is the second runner word the spec commits to; the negative below covers a command that is
  # neither, so the accepted set needs both its members exercised.
  Scenario: a marked entry running upx is pinned too
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "upx" with args "-y", "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y", "cyber-asana@0.10.0", "mcp"
    And the exit code is 0

  Scenario: a marked entry whose command is not a package runner warns and is left alone
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "node" with args "./server.js"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "./server.js"
    And stderr contains "srv"
    And the exit code is 0

  Scenario: a marked entry cannot be pinned when the manifest carries no version
    Given the manifest has no version
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y", "cyber-asana", "mcp"
    And stderr contains "version"
    And the exit code is 0

  Scenario: a marked entry with no package specifier in args warns and is left alone
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" mcpServers entry "srv" has args "-y"
    And stderr contains "srv"
    And the exit code is 0

  # Delivery follows the hooks rule: derive a file only for a vendor whose form differs from the
  # canonical one, and never rewrite what the author wrote.
  Scenario: a path declaration with a marked entry gets a derived mcp file and is repointed
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers "./mcp.json"
    And the authored "mcp.json" declares entry "srv" running "npx" with args "-y", "cyber-asana", "mcp" and the marker
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/mcp.json" is written
    And ".claude-plugin/mcp.json" entry "srv" has args "-y", "cyber-asana@0.10.0", "mcp"
    And ".claude-plugin/mcp.json" does not contain "pinToPluginVersion"
    And ".claude-plugin/plugin.json" contains mcpServers "./.claude-plugin/mcp.json"
    And the authored "mcp.json" is left unchanged

  Scenario: a path declaration with nothing marked derives no mcp file and keeps pointing at the authored one
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers "./mcp.json"
    And the authored "mcp.json" declares entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then no mcp file is derived for "claude-code"
    And ".claude-plugin/plugin.json" contains mcpServers "./mcp.json"

  Scenario: --dry-run derives no mcp file
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers "./mcp.json"
    And the authored "mcp.json" declares entry "srv" running "npx" with args "-y", "cyber-asana", "mcp" and the marker
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build --dry-run"
    Then ".claude-plugin/mcp.json" is NOT written
    And the exit code is 0

  # Copilot CLI reads the canonical manifest and its mcp file directly, so there is no derived
  # manifest to repoint and no derived file to deliver — the warning is the whole remedy.
  Scenario: copilot-cli is warned that a marked entry is not pinned for it
    Given the manifest version is "0.10.0"
    And the manifest declares mcpServers inline with entry "srv" running "npx" with args "-y", "cyber-asana", "mcp"
    And the "srv" entry sets "pinToPluginVersion" true
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then stderr contains "copilot-cli"
    And the canonical "plugin.json" is left unchanged
    And the exit code is 0

  # ── The Copilot spec-mode namespace (ADR-0015) ──

  # Declaring the canonical $schema puts a plugin in Copilot CLI's spec mode, which reads agents,
  # commands, rules, hooks/hooks.json and lsp.json only under com.github.copilot/ and no longer from
  # the plugin root. Verified against @github/copilot-linux-x64 1.0.83; the move landed in 1.0.80-0.

  Scenario: declared agents, commands, and rules are copied under the namespace
    Given the manifest declares agents "./agents/", commands "./commands/", and rules "./rules/"
    And "agents/reviewer.agent.md", "commands/ship.md", and "rules/style.md" exist
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/reviewer.agent.md" is written
    And "com.github.copilot/commands/ship.md" is written
    And "com.github.copilot/rules/style.md" is written
    And each copied file matches the authored file byte for byte
    And the exit code is 0

  # Copilot CLI reads agents/ as .agent.md files, while the canonical agents/ is the Claude Code
  # shaped *.md — a copy under the authored name would land a file the runtime ignores.
  Scenario: a copied agent is renamed to the .agent.md convention
    Given the manifest declares agents "./agents/"
    And "agents/reviewer.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/reviewer.agent.md" is written
    And "com.github.copilot/agents/reviewer.md" is NOT written
    And the exit code is 0

  Scenario: an agent already named .agent.md keeps its name
    Given the manifest declares agents "./agents/"
    And "agents/reviewer.agent.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/reviewer.agent.md" is written
    And "com.github.copilot/agents/reviewer.agent.agent.md" is NOT written
    And the exit code is 0

  Scenario: a component path array is resolved across every declared directory
    Given the extensions namespace declares agents as the array "./agents/" and "./more-agents/"
    And "agents/a.agent.md" and "more-agents/b.agent.md" exist
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/a.agent.md" is written
    And "com.github.copilot/agents/b.agent.md" is written
    And the exit code is 0

  Scenario: a component paths object is resolved across every declared directory
    Given the extensions namespace declares agents as a paths object listing "./agents/" and "./more-agents/"
    And "agents/a.agent.md" and "more-agents/b.agent.md" exist
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/a.agent.md" is written
    And "com.github.copilot/agents/b.agent.md" is written
    And the exit code is 0

  Scenario: a commands-only plugin is reported as built
    Given the manifest declares commands "./commands/"
    And "commands/ship.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "copilot-cli" is reported with status "built"
    And the exit code is 0

  Scenario: a rules-only plugin is reported as built
    Given the manifest declares rules "./rules/"
    And "rules/style.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "copilot-cli" is reported with status "built"
    And the exit code is 0

  Scenario: the schema default is read when the field is absent
    Given the extensions namespace declares no agents path
    And "agents/reviewer.agent.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/reviewer.agent.md" is written
    And the exit code is 0

  # A declared path that did not resolve is a loss the author can fix; an unused default is not.
  Scenario: a declared component directory that does not exist is warned about
    Given the manifest declares agents "./agents/"
    And no "agents/" directory exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then a warning names "agents" and the path "./agents/"
    And "copilot-cli" is reported with status "canonical"
    And the exit code is 0

  Scenario: an absent default directory is not warned about
    Given the extensions namespace declares only skills "./skills/"
    And no "agents/", "commands/", or "rules/" directory exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then no warning names "agents"
    And "copilot-cli" is reported with status "canonical"
    And the exit code is 0

  Scenario: a component declaration in none of the three forms warns and copies nothing
    Given the manifest declares agents as the number 7
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then a warning names "agents"
    And "com.github.copilot/agents/" is NOT written
    And "copilot-cli" is reported with status "canonical"
    And the exit code is 0

  # The aggregate suffix reports the vendors root plugin.json serves whole. It is reachable only
  # while some vendor is canonical, which is now conditional rather than copilot-cli's fixed result.
  Scenario: the aggregate names the vendors the canonical manifest serves
    Given the extensions namespace declares only skills "./skills/"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then stdout contains "served by plugin.json 1"
    And the exit code is 0

  # The suffix is conditional on a vendor being canonical, and copilot-cli is no longer canonical
  # unconditionally — a build that still assumed it was would report a vendor it did not serve.
  Scenario: the aggregate omits the suffix when copilot-cli derives its components
    Given the manifest declares agents "./agents/"
    And "agents/reviewer.agent.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then stdout contains "built 1"
    And stdout does not contain "served by plugin.json"
    And the exit code is 0

  Scenario: the vendor is reported as built at the namespace directory
    Given the manifest declares agents "./agents/"
    And "agents/reviewer.agent.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "copilot-cli" is reported with status "built"
    And "copilot-cli" is reported with path "com.github.copilot/"
    And the canonical "plugin.json" is left unchanged
    And the exit code is 0

  # Every derived kind flips the status, not just the copied ones — hooks are translated rather than
  # copied, and a plugin whose only Copilot content is a hook still has a tree the runtime reads.
  Scenario: hooks are translated to the fixed spec-mode path
    Given the authored hooks declare one command handler on "SessionStart"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/hooks/hooks.json" is written
    And "com.github.copilot/hooks/hooks.json" contains "SessionStart"
    And "copilot-cli" is reported with status "built"
    And the exit code is 0

  # A declared lsp path is copied verbatim: the file's top-level shape is the authored one, and the
  # runtime does not document it, so the build carries the file rather than composing one.
  Scenario: a declared lspServers path is copied to the namespace lsp.json
    Given the manifest declares lspServers "./.lsp.json"
    And the authored ".lsp.json" declares entry "tf"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/lsp.json" is written
    And "com.github.copilot/lsp.json" matches the authored ".lsp.json" byte for byte
    And "copilot-cli" is reported with status "built"
    And the exit code is 0

  Scenario: an inline lspServers map warns rather than guessing the file shape
    Given the manifest declares lspServers inline with entry "tf"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then a warning names "copilot-cli" and "lspServers"
    And "com.github.copilot/lsp.json" is NOT written
    And "copilot-cli" is reported with status "canonical"
    And the exit code is 0

  # skills/ and mcp.json are read from the plugin root in spec mode, so copying them would ship a
  # second copy nothing reads.
  Scenario: skills and mcp.json are not copied into the namespace
    Given the manifest declares skills "./skills/", mcpServers "./mcp.json", and agents "./agents/"
    And a skill "reviewer" exists under "skills/"
    And "agents/reviewer.agent.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/agents/reviewer.agent.md" is written
    And "com.github.copilot/skills/" is NOT written
    And "com.github.copilot/mcp.json" is NOT written
    And the exit code is 0

  # The status names what the build derived, never what the directory happens to hold — extensions
  # are authored there, so their presence alone is not a derivation.
  Scenario: an authored extensions directory is passed through untouched
    Given "com.github.copilot/extensions/canvas/extension.json" is authored
    And the extensions namespace declares only skills "./skills/"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then "com.github.copilot/extensions/canvas/extension.json" is left unchanged
    And "copilot-cli" is reported with status "canonical"
    And the exit code is 0

  Scenario: --clean replaces the derived tree but leaves authored extensions
    Given the manifest declares agents "./agents/"
    And "agents/reviewer.agent.md" exists
    And a stale "com.github.copilot/agents/removed.agent.md" exists
    And "com.github.copilot/extensions/canvas/extension.json" is authored
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build --clean"
    Then "com.github.copilot/agents/removed.agent.md" is NOT written
    And "com.github.copilot/agents/reviewer.agent.md" is written
    And "com.github.copilot/extensions/canvas/extension.json" is left unchanged
    And the exit code is 0

  Scenario: --dry-run derives no namespace files
    Given the manifest declares agents "./agents/"
    And "agents/reviewer.agent.md" exists
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build --dry-run"
    Then "com.github.copilot/agents/reviewer.agent.md" is NOT written
    And "copilot-cli" is reported with status "built"
    And the exit code is 0

  # ── Vendor filtering ──

  Scenario: --vendor filters to a single vendor
    Given the manifest declares harnesses for "claude-code" and "cursor"
    When I run "universal-plugin plugin build --vendor claude-code"
    Then ".claude-plugin/plugin.json" is written
    And ".cursor-plugin/plugin.json" is NOT written
    And the exit code is 0

  Scenario: --vendor not among the targets fails
    Given the manifest declares harnesses for "claude-code" only
    When I run "universal-plugin plugin build --vendor cursor"
    Then the exit code is 1
    And stderr contains "not declared in harnesses"

  # ── Warnings, not errors ──

  Scenario: no targets declared is a definitive empty state
    Given the manifest has no harnesses and no vendors list
    When I run "universal-plugin plugin build"
    Then the exit code is 0
    And no output files are written
    And stdout is TOON with zero built rows and the aggregate "built 0"
    And stderr contains "nothing to build"

  Scenario: the definitive empty state names doctor as the next step
    Given the manifest has no harnesses and no vendors list
    And the project root carries no pre-0.6 layout signal
    When I run "universal-plugin plugin build"
    Then the exit code is 0
    And stderr names "/universal-plugin:doctor"

  Scenario: unknown vendor in harnesses is warned and skipped
    Given harnesses contains an unknown vendor key "acme"
    When I run "universal-plugin plugin build"
    Then the exit code is 0
    And stdout or stderr contains "Unknown vendor"
    And no output file is written for "acme"

  # ── Eager validation ──

  Scenario: missing plugin.json fails
    Given the project root has no canonical "plugin.json"
    When I run "universal-plugin plugin build"
    Then the exit code is 1
    And stderr contains "No plugin.json found"

  Scenario: codex vendor requires description and version
    Given the manifest declares harnesses for "codex"
    And the manifest has no description or version
    When I run "universal-plugin plugin build"
    Then the exit code is 1
    And stderr contains "description is required when targeting codex"
    And stderr contains "version is required when targeting codex"

  # ── A declaration this CLI no longer reads ──

  Scenario: a pre-0.6 vendorExtensions block that derives nothing fails loud
    Given the root manifest carries a top-level "vendorExtensions" block
    And the manifest declares no harnesses and no vendors list
    When I run "universal-plugin plugin build"
    Then the exit code is 1
    And stderr contains "vendorExtensions"
    And stderr names "/universal-plugin:doctor"
    And no output files are written

  Scenario: a shadowing .plugin/plugin.json that derives nothing fails loud
    Given the project root also carries ".plugin/plugin.json"
    And the manifest declares no harnesses and no vendors list
    When I run "universal-plugin plugin build"
    Then the exit code is 1
    And stderr contains ".plugin/plugin.json"
    And stderr names "/universal-plugin:doctor"
    And no output files are written

  Scenario: a pre-0.6 signal beside harnesses that still derive is not a build failure
    Given the project root also carries ".plugin/plugin.json"
    And the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then ".claude-plugin/plugin.json" is written
    And the exit code is 0

  # ── Write-control flags ──

  Scenario: --dry-run skips file writes
    Given the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build --dry-run"
    Then the exit code is 0
    And ".claude-plugin/plugin.json" is NOT written

  Scenario: --clean removes existing output before writing
    Given ".claude-plugin/plugin.json" already exists from a previous build
    When I run "universal-plugin plugin build --clean"
    Then ".claude-plugin/plugin.json" is removed and rewritten
    And the exit code is 0

  # ── AXI output contract ──

  Scenario: a successful build prints a TOON result with per-vendor status and aggregate
    Given the manifest declares harnesses for "claude-code" and "cursor"
    When I run "universal-plugin plugin build"
    Then stdout is TOON with one row per vendor carrying "vendor", "path", "status"
    And each row's "status" is "built", "skipped", or "failed"
    And stdout contains the aggregate summary "built 2, skipped 0, failed 0"
    And the exit code is 0

  Scenario: --format json returns a structured build result
    Given the manifest declares harnesses for "claude-code" and "cursor"
    When I run "universal-plugin plugin build --format json"
    Then stdout is JSON with a "built" array
    And stdout contains the summary counts "built", "skipped", "failed"
    And the exit code is 0

  Scenario: --format toon names the default explicitly
    Given the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build --format toon"
    Then stdout is TOON with one row per vendor
    And the exit code is 0

  Scenario: a successful build ends with a next-step suggestion
    Given the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then stderr ends with "→ universal-plugin plugin validate"

  Scenario: build never prompts interactively
    Given the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build"
    Then no interactive prompts are shown
    And the exit code is 0

  Scenario: an unknown flag fails loud
    Given the manifest declares harnesses for "claude-code"
    When I run "universal-plugin plugin build --frobnicate"
    Then the exit code is 1
    And stderr contains "--frobnicate"

  # ── Refresh the repository-local catalogs (ADR-0010 §3) ──

  Scenario: the entry for this plugin is re-derived in an existing repository catalog
    Given the project root is inside a repository that carries ".agents/plugins/marketplace.json"
    And that catalog lists this plugin with an older version and another plugin
    And the manifest declares harnesses for "codex"
    When I run "universal-plugin plugin build"
    Then the catalog entry for this plugin carries the canonical manifest version
    And the other plugin's entry and the catalog's own fields are unchanged
    And the exit code is 0

  Scenario: a catalog the repository does not carry is not created
    Given the project root is inside a repository that carries no marketplace catalog
    And the manifest declares harnesses for "codex"
    When I run "universal-plugin plugin build"
    Then no marketplace catalog is written
    And the exit code is 0

  Scenario: only the vendors being built are refreshed
    Given the repository carries both the Claude and the Codex catalog
    When I run "universal-plugin plugin build --vendor codex"
    Then ".agents/plugins/marketplace.json" is refreshed
    And ".claude-plugin/marketplace.json" is unchanged

  Scenario: --dry-run plans the refresh and writes nothing
    Given the repository carries a catalog whose entry for this plugin is out of date
    When I run "universal-plugin plugin build --dry-run"
    Then the catalog is reported as planned
    And the catalog file is unchanged

  Scenario: --help prints a concise reference
    When I run "universal-plugin plugin build --help"
    Then the exit code is 0
    And stdout contains a synopsis, the flags, and one example
