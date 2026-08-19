@frozen
Feature: plugin install / uninstall — put the working copy into a runtime, and take it back out

  Background:
    Given a plugin root whose manifest declares "claude-code", "cursor", and "codex"
    And "claude-code" scans a local plugin directory and follows an out-of-tree symlink
    And "cursor" scans a local plugin directory and rejects an out-of-tree symlink
    And "codex" scans no local plugin directory
    And the derived vendor manifests have been built

  # ── Install into every declared runtime ──

  Scenario: links the project root into a vendor that follows a symlink
    When I run "universal-plugin plugin install --vendor claude-code --root <root>"
    Then the exit code is 0
    And the "claude-code" destination is a symlink resolving to the project root

  Scenario: copies into a vendor that rejects an out-of-tree symlink
    When I run "universal-plugin plugin install --vendor cursor --root <root>"
    Then the exit code is 0
    And the "cursor" destination is a directory
    And the "cursor" destination contains "plugin.json"

  Scenario: a copy leaves node_modules and .git behind
    Given the project root contains "node_modules/" and ".git/"
    When I run "universal-plugin plugin install --vendor cursor --root <root>"
    Then the "cursor" destination contains no "node_modules"
    And the "cursor" destination contains no ".git"

  Scenario: installs into every vendor the manifest declares
    When I run "universal-plugin plugin install --root <root>"
    Then the exit code is 0
    And the result carries one row per declared vendor, in manifest order

  Scenario: a vendor with no local plugin directory is reported, not failed
    When I run "universal-plugin plugin install --vendor codex --root <root>"
    Then the exit code is 0
    And the "codex" row's action is "unsupported"
    And nothing is written for "codex"

  Scenario: --copy snapshots even where a symlink would load
    When I run "universal-plugin plugin install --vendor claude-code --copy --root <root>"
    Then the "claude-code" destination is a directory

  Scenario: --link fails a vendor that will not load one, naming --copy
    When I run "universal-plugin plugin install --vendor cursor --link --root <root>"
    Then the exit code is 1
    And stderr contains "--copy"
    And the "cursor" destination does not exist

  Scenario: the run names the reload step each written vendor now needs
    When I run "universal-plugin plugin install --vendor claude-code --root <root>"
    Then stderr names the reload step for "claude-code"

  Scenario: re-running changes nothing and stays green
    Given "claude-code" already holds this plugin as a symlink
    When I run "universal-plugin plugin install --vendor claude-code --root <root>"
    Then the exit code is 0
    And the "claude-code" row's action is "unchanged"

  Scenario: an earlier install of this plugin is replaced, not stacked
    Given "claude-code" already holds this plugin as a copy
    When I run "universal-plugin plugin install --vendor claude-code --copy --root <root>"
    Then the exit code is 0
    And the "claude-code" row's action is "copied"

  Scenario: a destination this plugin does not own is refused and left alone
    Given the "claude-code" destination holds a plugin named "someone-else"
    When I run "universal-plugin plugin install --vendor claude-code --root <root>"
    Then the exit code is 1
    And stderr contains "--force"
    And the "claude-code" destination still holds "someone-else"

  Scenario: --force replaces a destination this plugin does not own
    Given the "claude-code" destination holds a plugin named "someone-else"
    When I run "universal-plugin plugin install --vendor claude-code --force --root <root>"
    Then the exit code is 0
    And the "claude-code" destination is a symlink resolving to the project root

  Scenario: a missing derived manifest fails the run, naming plugin build
    Given the derived manifest for "claude-code" is absent
    When I run "universal-plugin plugin install --vendor claude-code --root <root>"
    Then the exit code is 1
    And stderr contains "plugin build"
    And the "claude-code" destination does not exist

  Scenario: an undeclared vendor fails the run
    When I run "universal-plugin plugin install --vendor copilot-cli --root <root>"
    Then the exit code is 1
    And stderr contains "not declared"

  Scenario: a successful run prints a TOON row per vendor plus the aggregate
    When I run "universal-plugin plugin install --root <root>"
    Then stdout carries a row per vendor with its vendor, path, and action
    And stdout carries a summary line counting installed, unchanged, blocked, and unsupported

  Scenario: --format json returns the rows and the summary
    When I run "universal-plugin plugin install --format json --root <root>"
    Then stdout is JSON carrying "rows" and "summary"

  # ── See where it would go ──

  Scenario: --list resolves the destinations without writing
    When I run "universal-plugin plugin install --vendor claude-code --list --root <root>"
    Then the exit code is 0
    And stdout names the "claude-code" destination path
    And the "claude-code" destination does not exist

  # ── Remove the install ──

  Scenario: uninstall removes what install put there
    Given "claude-code" already holds this plugin as a symlink
    When I run "universal-plugin plugin uninstall --vendor claude-code --root <root>"
    Then the exit code is 0
    And the "claude-code" destination does not exist

  Scenario: uninstall removes a copied install
    Given "cursor" already holds this plugin as a copy
    When I run "universal-plugin plugin uninstall --vendor cursor --root <root>"
    Then the exit code is 0
    And the "cursor" destination does not exist

  Scenario: uninstalling twice reports the destination as missing
    Given the "claude-code" destination does not exist
    When I run "universal-plugin plugin uninstall --vendor claude-code --root <root>"
    Then the exit code is 0
    And the "claude-code" row's action is "missing"

  Scenario: uninstall never removes another plugin
    Given the "claude-code" destination holds a plugin named "someone-else"
    When I run "universal-plugin plugin uninstall --vendor claude-code --root <root>"
    Then the exit code is 1
    And the "claude-code" destination still holds "someone-else"

  Scenario: --force removes a destination this plugin does not own
    Given the "claude-code" destination holds a plugin named "someone-else"
    When I run "universal-plugin plugin uninstall --vendor claude-code --force --root <root>"
    Then the exit code is 0
    And the "claude-code" destination does not exist

  Scenario: uninstall does not require a derived manifest
    Given the derived manifest for "claude-code" is absent
    And "claude-code" already holds this plugin as a symlink
    When I run "universal-plugin plugin uninstall --vendor claude-code --root <root>"
    Then the exit code is 0

  Scenario: uninstall --list removes nothing
    Given "claude-code" already holds this plugin as a symlink
    When I run "universal-plugin plugin uninstall --vendor claude-code --list --root <root>"
    Then the exit code is 0
    And the "claude-code" destination still exists

  # ── Print the command reference ──

  Scenario: --help prints a concise reference
    When I run "universal-plugin plugin install --help"
    Then the exit code is 0
    And stdout carries a synopsis, the flags, and one example
