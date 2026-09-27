@frozen
Feature: governance — retired, pointing at reference
  universal-plugin governance no longer resolves documents. For one release every form of it but
  --help prints that it is retired and what replaces it — buddy-agent-harness reference, or the
  load-reference skill in the buddy-agent-harness plugin — and exits 1. The release after that
  removes it.

  Background:
    Given the project root is a temporary directory

  # ── show ──

  Scenario: show names its replacement and fails
    When I run "universal-plugin governance show plugin-design"
    Then the exit code is 1
    And stdout is empty
    And stderr says "governance" is retired
    And stderr contains "→ buddy-agent-harness reference show plugin-design"
    And stderr names the "load-reference" skill in the "buddy-agent-harness" plugin

  Scenario: show prints no document even where one used to resolve
    Given a file "plugin-design.md" exists in "<root>/.agents/governances/"
    When I run "universal-plugin governance show plugin-design --root <root>"
    Then the exit code is 1
    And stdout is empty
    And stderr contains "→ buddy-agent-harness reference show plugin-design"

  Scenario: show with no name names the replacement with a placeholder
    When I run "universal-plugin governance show"
    Then the exit code is 1
    And stdout is empty
    And stderr contains "→ buddy-agent-harness reference show <name>"

  # ── list and bare governance ──

  Scenario: list names its replacement and fails
    When I run "universal-plugin governance list"
    Then the exit code is 1
    And stdout is empty
    And stderr says "governance" is retired
    And stderr contains "→ buddy-agent-harness reference list"
    And stderr names the "load-reference" skill in the "buddy-agent-harness" plugin

  Scenario: bare governance names the list replacement and fails
    When I run "universal-plugin governance"
    Then the exit code is 1
    And stdout is empty
    And stderr contains "→ buddy-agent-harness reference list"
    And stderr names the "load-reference" skill in the "buddy-agent-harness" plugin

  # ── old flags ──

  Scenario: the flags the command used to take still get the retirement message
    When I run "universal-plugin governance show --root <root> plugin-design --format json"
    Then the exit code is 1
    And stdout is empty
    And stderr contains "→ buddy-agent-harness reference show plugin-design"

  Scenario: the hidden --json flag still gets the retirement message
    When I run "universal-plugin governance list --json"
    Then the exit code is 1
    And stdout is empty
    And stderr contains "→ buddy-agent-harness reference list"

  Scenario: an unknown flag still gets the retirement message
    When I run "universal-plugin governance list --frobnicate"
    Then the exit code is 1
    And stderr contains "→ buddy-agent-harness reference list"

  # ── help ──

  Scenario: help says the command is retired
    When I run "universal-plugin governance --help"
    Then the exit code is 0
    And stdout says the command is retired
    And stdout names "buddy-agent-harness reference"
