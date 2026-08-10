@frozen
Feature: marketplace init — generate repository-local marketplace metadata

  Background:
    Given a repository root with a root "plugin.json" author and eligible plugins below "plugins"

  Scenario: default initialization creates Claude Codex and Copilot catalogs
    When I run "universal-plugin marketplace init --root <root>"
    Then Claude Codex and Copilot marketplace metadata are generated
    And Cursor has status "skipped-default"
    And the exit code is 0

  Scenario: explicit selectors generate exactly their target union
    When I run "universal-plugin marketplace init --claude --copilot --root <root>"
    Then only Claude and Copilot marketplace metadata are generated
    And the exit code is 0

  Scenario: explicit Cursor creates a local submission scaffold without provisioning
    When I run "universal-plugin marketplace init --cursor --root <root>"
    Then Cursor submission JSON and Markdown are generated
    And the Markdown links the Cursor dashboard
    And the output says no publication or provisioning occurred
    And the exit code is 0

  Scenario: a missing default plugins directory is an empty success
    Given the root has no "plugins" directory
    When I run "universal-plugin marketplace init --root <root>"
    Then each default catalog target has status "empty"
    And the exit code is 0

  Scenario: explicit scan directories must exist and stay under the root
    When I run "universal-plugin marketplace init --plugin-scan-dir ../outside --root <root>"
    Then the exit code is 1
    And stderr contains "within --root"

  Scenario: malformed manifests and duplicate plugin names fail before any write
    Given an eligible plugin manifest is malformed or repeats another plugin name
    When I run "universal-plugin marketplace init --root <root>"
    Then the exit code is 1
    And no selected marketplace artifact is changed

  Scenario: dry run plans artifacts without writing them
    When I run "universal-plugin marketplace init --dry-run --root <root>"
    Then each selected target has status "planned"
    And no marketplace artifact is written

  Scenario: an equivalent rerun is unchanged and a conflict requires force
    Given selected marketplace artifacts already contain equivalent JSON
    When I run "universal-plugin marketplace init --root <root>"
    Then each selected target has status "unchanged"
    And the exit code is 0
    When a selected artifact differs and I rerun without "--force"
    Then the exit code is 1
    And stderr contains "--force"

  Scenario: JSON output returns the result structure
    When I run "universal-plugin marketplace init --format json --root <root>"
    Then stdout is valid JSON with result entries containing "target", "status", "paths", and "plugins"
    And the exit code is 0
