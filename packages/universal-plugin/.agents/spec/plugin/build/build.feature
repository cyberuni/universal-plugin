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
  Scenario: copilot-cli derives nothing — the canonical root manifest serves it
    Given the manifest declares harnesses for "copilot-cli"
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

  # Copilot CLI reads the canonical root manifest and its hooks file directly, so there is no derived
  # manifest to repoint and no derived hooks file to deliver — the warning is the whole remedy.
  Scenario: copilot-cli warns that an unsupported handler is ignored at runtime
    Given the authored hooks declare one agent handler on "SessionStart"
    And the manifest declares harnesses for "copilot-cli"
    When I run "universal-plugin plugin build"
    Then a warning names "copilot-cli", "SessionStart", and the type "agent"
    And no hooks file is derived for "copilot-cli"
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

  Scenario: --help prints a concise reference
    When I run "universal-plugin plugin build --help"
    Then the exit code is 0
    And stdout contains a synopsis, the flags, and one example
