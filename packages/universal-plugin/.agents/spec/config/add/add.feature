@frozen
Feature: config add — register a keyed config entry

  Background:
    Given a project root resolved from the current working directory

  # ── Append & replace ──

  Scenario: appends a new entry when no name matches
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "quill"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\",\"handles\":[\"agent evaluation\"]}'"
    Then the "sdd-plugins" array contains an entry named "aces"
    And the "sdd-plugins" array still contains an entry named "quill"
    And the exit code is 0

  Scenario: creates the key when it does not yet exist
    Given ".agents/universal-plugin.json" has no key "sdd-plugins"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}'"
    Then the "sdd-plugins" array has exactly one entry named "aces"
    And the exit code is 0

  Scenario: replaces an existing entry with the same name in place
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "aces" with handles "old"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\",\"handles\":[\"new\"]}'"
    Then the "sdd-plugins" array has exactly one entry named "aces"
    And the "aces" entry has handles "new"
    And the exit code is 0

  Scenario: a replace preserves the entry's array position among siblings
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with entries named "quill", "aces", "cyberplace" in that order
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\",\"handles\":[\"new\"]}'"
    Then the "sdd-plugins" array has entries named "quill", "aces", "cyberplace" in that order
    And the "aces" entry has handles "new"
    And the exit code is 0

  Scenario: re-running the same add is idempotent
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "aces" with handles "new"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\",\"handles\":[\"new\"]}'"
    Then the "sdd-plugins" array has exactly one entry named "aces"
    And the file content is unchanged
    And the exit code is 0

  # ── File & key preservation ──

  Scenario: creates the config file when it is absent
    Given no ".agents/universal-plugin.json" exists at the root
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}'"
    Then ".agents/universal-plugin.json" is created
    And the "sdd-plugins" array has exactly one entry named "aces"
    And the exit code is 0

  Scenario: preserves other top-level keys on write
    Given ".agents/universal-plugin.json" has "packagePath", a key "other-plugins" with an entry named "x", and an unknown key "future"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}'"
    Then "packagePath" is unchanged
    And the "other-plugins" array is unchanged
    And the unknown key "future" is unchanged
    And the exit code is 0

  # ── Reserved key ──

  Scenario: rejects the reserved key packagePath
    Given ".agents/universal-plugin.json" has "packagePath" set to a string
    When I run "universal-plugin config add --key packagePath --entry '{\"name\":\"x\"}'"
    Then the exit code is 1
    And stderr names "packagePath" as reserved
    And "packagePath" is unchanged and still a string

  # ── Validation & required name ──

  Scenario: an entry with no name field fails and writes nothing
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "quill"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"handles\":[\"x\"]}'"
    Then the exit code is 1
    And stderr names the missing "name" requirement
    And the "sdd-plugins" array is unchanged

  Scenario: an entry that is not a JSON object fails and writes nothing
    When I run "universal-plugin config add --key sdd-plugins --entry '\"just a string\"'"
    Then the exit code is 1
    And stderr says the entry must be a JSON object
    And the file is unchanged

  Scenario: an entry that is not valid JSON fails and writes nothing
    When I run "universal-plugin config add --key sdd-plugins --entry '{not json}'"
    Then the exit code is 1
    And stderr says the entry is not valid JSON
    And the file is unchanged

  Scenario: a missing --key fails naming the flag
    When I run "universal-plugin config add --entry '{\"name\":\"aces\"}'"
    Then the exit code is 1
    And stderr names the "--key" flag

  Scenario: a missing --entry fails naming the flag
    When I run "universal-plugin config add --key sdd-plugins"
    Then the exit code is 1
    And stderr names the "--entry" flag

  # ── AXI output contract ──

  Scenario: successful add prints a TOON row by default
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}'"
    Then stdout is a TOON result with one row for key "sdd-plugins" name "aces" action "appended"
    And stdout includes a pre-computed aggregate for the "sdd-plugins" entry count
    And the exit code is 0

  Scenario: a replace reports action "replaced"
    Given ".agents/universal-plugin.json" has key "sdd-plugins" with an entry named "aces"
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}'"
    Then the TOON row reports action "replaced"

  Scenario: --format json returns the same shape as structured JSON
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}' --format json"
    Then stdout is valid JSON carrying key "sdd-plugins", name "aces", and action "appended"
    And the exit code is 0

  Scenario: --format toon names the default explicitly
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}' --format toon"
    Then stdout is a TOON result
    And the exit code is 0

  Scenario: a successful add suggests config get as the next step
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}'"
    Then stderr ends with "→ universal-plugin config get --key sdd-plugins"

  # ── Fail-loud & help ──

  Scenario: an unknown flag exits naming the flag
    When I run "universal-plugin config add --key sdd-plugins --entry '{\"name\":\"aces\"}' --bogus"
    Then the exit code is 1
    And stderr names "--bogus"

  Scenario: --help exits zero with a synopsis and one example
    When I run "universal-plugin config add --help"
    Then the exit code is 0
    And stdout contains a synopsis, the flags, and one example
