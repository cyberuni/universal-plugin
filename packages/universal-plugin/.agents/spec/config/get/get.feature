@frozen
Feature: config get — read a keyed config array

  Background:
    Given a project root resolved from the current working directory

  # ── Read entries ──

  Scenario: reads the entries registered at a key
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with entries named "aces" and "quill"
    When I run "universal-plugin config get --key sdd-plugins"
    Then stdout lists an entry named "aces"
    And stdout lists an entry named "quill"
    And the exit code is 0

  # ── AXI output contract ──

  Scenario: default output is a TOON result keyed on name with an aggregate
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with entries named "aces" and "quill"
    When I run "universal-plugin config get --key sdd-plugins"
    Then stdout is a TOON result with one row per entry keyed on "name"
    And stdout includes a pre-computed aggregate "sdd-plugins: 2 entries"
    And the exit code is 0

  Scenario: --format json returns the raw stored array
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry '{"name":"aces","handles":["agent evaluation"]}'
    When I run "universal-plugin config get --key sdd-plugins --format json"
    Then stdout is valid JSON equal to the stored array for "sdd-plugins"
    And the JSON is not truncated
    And the exit code is 0

  Scenario: --format toon names the default explicitly
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "aces"
    When I run "universal-plugin config get --key sdd-plugins --format toon"
    Then stdout is a TOON result
    And the exit code is 0

  # ── Definitive empty state ──

  Scenario: an absent key prints a definitive empty state
    Given ".agents/universal-plugin.json" has no key "sdd-plugins"
    When I run "universal-plugin config get --key sdd-plugins"
    Then stdout is a TOON result with zero rows and aggregate "0 entries"
    And the exit code is 0

  Scenario: a key present with an empty array prints a definitive empty state
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an empty array
    When I run "universal-plugin config get --key sdd-plugins"
    Then stdout is a TOON result with zero rows and aggregate "0 entries"
    And the exit code is 0

  Scenario: --format json on an absent key prints an empty array
    Given ".agents/universal-plugin.json" has no key "sdd-plugins"
    When I run "universal-plugin config get --key sdd-plugins --format json"
    Then stdout is "[]"
    And the exit code is 0

  Scenario: a missing config file is treated as an absent key
    Given no ".agents/universal-plugin.json" exists at the root
    When I run "universal-plugin config get --key sdd-plugins"
    Then stdout is a TOON result with zero rows and aggregate "0 entries"
    And the exit code is 0

  # ── Reserved key ──

  Scenario: rejects the reserved key packagePath
    Given ".agents/universal-plugin.json" has "packagePath" set to a string
    When I run "universal-plugin config get --key packagePath"
    Then the exit code is 1
    And stderr names "packagePath" as reserved

  # ── Fail-loud & help ──

  Scenario: a missing --key fails naming the flag
    When I run "universal-plugin config get"
    Then the exit code is 1
    And stderr names the "--key" flag

  Scenario: a get suggests config add as the next step
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "aces"
    When I run "universal-plugin config get --key sdd-plugins"
    Then stderr ends with "→ universal-plugin config add --key sdd-plugins --entry <json>"

  Scenario: an unknown flag exits naming the flag
    When I run "universal-plugin config get --key sdd-plugins --bogus"
    Then the exit code is 1
    And stderr names "--bogus"

  Scenario: --help exits zero with a synopsis and one example
    When I run "universal-plugin config get --help"
    Then the exit code is 0
    And stdout contains a synopsis, the flags, and one example
